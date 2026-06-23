import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { ramphubOrdersTable } from "@workspace/db";
import { usersTable, referralsTable, affiliateCommissionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import {
  getQuote,
  createOrder,
  monitorStatus,
  isRamphubEnabled,
} from "../lib/ramphub.js";
import { logger } from "../lib/logger.js";

const router = Router();

const RAMPHUB_WEBHOOK_SECRET = process.env.RAMPHUB_WEBHOOK_SECRET || "";
const TREASURY_WALLET = process.env.RAMPHUB_WALLET_ADDRESS || "0x49B474B5d420851cE68e024Eb2AF77fEDB8e898C";

const TIER_USDT: Record<string, number> = {
  monthly: 5,
  yearly: 45,
  lifetime: 250,
};

// ── Public: check if RampHub is enabled ────────────────────────
router.get("/status", (_req, res) => {
  res.json({ enabled: isRamphubEnabled() });
});

// ── Public: get NGN quote for a tier ───────────────────────────
router.get("/quote", async (req, res) => {
  const tier = req.query.tier as string;
  if (!tier || !TIER_USDT[tier]) {
    res.status(400).json({ error: "Invalid tier. Use monthly, yearly, or lifetime." });
    return;
  }
  if (!isRamphubEnabled()) {
    res.status(503).json({ error: "RampHub not configured" });
    return;
  }
  try {
    const tokenAmount = TIER_USDT[tier];
    const quote = await getQuote({
      side: "sell",
      tokenAmount,
      fiatCurrency: "NGN",
      asset: "USDT",
      chain: "base",
    });
    const rate = quote.bestQuote?.rate ?? 0;
    const ngnAmount = Math.ceil(tokenAmount * rate * 1.005);
    res.json({
      tier,
      usdtAmount: tokenAmount,
      ngnAmount,
      rate,
      provider: quote.bestQuote?.provider,
      estimatedOutput: quote.bestQuote?.estimatedOutput,
    });
  } catch (e: any) {
    logger.warn({ err: e.message }, "RampHub quote failed");
    res.status(500).json({ error: e.message });
  }
});

// ── Webhook: RampHub sends transaction events here (PUBLIC) ────
router.post("/webhook", async (req, res) => {
  if (RAMPHUB_WEBHOOK_SECRET) {
    const signature = req.headers["x-ramphub-signature"] as string | undefined;
    if (!signature) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }
    const rawBody = JSON.stringify(req.body);
    const computed = crypto
      .createHmac("sha256", RAMPHUB_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    const valid = crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature)
    );
    if (!valid) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  const payload = req.body as Record<string, unknown>;
  const eventType = payload?.type as string | undefined;
  const data = payload?.data as Record<string, unknown> | undefined;
  const transactionId = data?.transactionId as string | undefined;

  logger.info({ event: eventType, transactionId }, "RampHub webhook received");

  if (!transactionId) {
    res.status(400).json({ error: "Missing transactionId" });
    return;
  }

  let status: string;
  if (eventType === "transaction.completed") {
    status = "COMPLETED";
  } else if (eventType === "transaction.failed") {
    status = "FAILED";
  } else if (eventType === "transaction.created") {
    status = "AWAITING_PAYMENT";
  } else {
    status = "UPDATED";
  }

  try {
    const [existing] = await db
      .select()
      .from(ramphubOrdersTable)
      .where(eq(ramphubOrdersTable.transactionId, transactionId));

    if (existing) {
      await db
        .update(ramphubOrdersTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(ramphubOrdersTable.transactionId, transactionId));
    }

    if (status === "COMPLETED" && existing) {
      const newPlan = existing.tier === "lifetime" ? "lifetime" : "active";
      let subscriptionEndsAt: Date | null = null;

      if (existing.tier !== "lifetime") {
        const [user] = await db
          .select({ trialEndsAt: usersTable.trialEndsAt, subscriptionEndsAt: usersTable.subscriptionEndsAt })
          .from(usersTable)
          .where(eq(usersTable.id, existing.userId));

        const now = new Date();
        const baseDate =
          user?.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now
            ? new Date(user.subscriptionEndsAt)
            : user?.trialEndsAt && new Date(user.trialEndsAt) > now
            ? new Date(user.trialEndsAt)
            : now;

        subscriptionEndsAt = new Date(baseDate);
        if (existing.tier === "monthly") {
          subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 31);
        } else if (existing.tier === "yearly") {
          subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 366);
        }
      }

      await db
        .update(usersTable)
        .set({ plan: newPlan, subscriptionEndsAt, updatedAt: new Date() })
        .where(eq(usersTable.id, existing.userId));

      const [updatedReferral] = await db
        .update(referralsTable)
        .set({ tier: existing.tier, referredUserPlan: newPlan, qualifies: true })
        .where(eq(referralsTable.referredUserId, existing.userId))
        .returning({ id: referralsTable.id, referrerId: referralsTable.referrerId });

      if (updatedReferral) {
        const t = existing.tier;
        let commAmount = 0;
        let commStatus = "pending";
        if (t === "lifetime") { commAmount = 50; commStatus = "approved"; }
        else if (t === "yearly") { commAmount = 9; commStatus = "approved"; }
        else if (t === "monthly") { commAmount = 1; commStatus = "pending"; }
        if (commAmount > 0) {
          await db.insert(affiliateCommissionsTable)
            .values({
              referrerId: updatedReferral.referrerId,
              referredUserId: existing.userId,
              referralId: updatedReferral.id,
              plan: t,
              amount: commAmount.toFixed(2),
              status: commStatus,
            })
            .onConflictDoUpdate({
              target: affiliateCommissionsTable.referralId,
              set: { plan: t, amount: commAmount.toFixed(2), status: commStatus },
            });
        }
      }

      logger.info({ userId: existing.userId, transactionId, tier: existing.tier, plan: newPlan }, "RampHub: subscription activated");
    }

    res.status(200).json({ received: true, status });
  } catch (e: any) {
    logger.error({ err: e.message }, "RampHub webhook processing failed");
    res.status(500).json({ error: e.message });
  }
});

// ── Auth required from here ────────────────────────────────────
router.use(requireAuth);

// ── Create a buy order for a subscription tier ─────────────────
router.post("/order", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { tier, ngnAmount, email, overrideActiveIntent } = req.body;

  if (!tier || !TIER_USDT[tier]) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }
  if (!isRamphubEnabled()) {
    res.status(503).json({ error: "RampHub not configured" });
    return;
  }

  const usdtAmount = TIER_USDT[tier];

  const [userRow] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const userEmail = email || userRow?.email || undefined;

  try {
    const result = await createOrder({
      side: "buy",
      amount: usdtAmount,
      fiatAmount: ngnAmount || Math.ceil(usdtAmount * 1600),
      fiatCurrency: "NGN",
      asset: "USDT",
      chain: "base",
      walletAddress: TREASURY_WALLET,
      externalCustomerId: `user_${userId}`,
      email: userEmail,
      overrideActiveIntent: overrideActiveIntent ?? false,
    });

    if ((result as any).code === "PAYCHAIN_ACTIVE_INTENT_CONFLICT") {
      res.status(409).json({
        error: "ACTIVE_INTENT_CONFLICT",
        message: "You have an active payment window. Pass overrideActiveIntent: true to replace it.",
        conflict: (result as any).conflict,
      });
      return;
    }

    await db.insert(ramphubOrdersTable).values({
      userId,
      tier,
      transactionId: result.transactionId,
      requestReference: result.requestReference,
      selectedProvider: result.selectedProvider,
      ngnAmount: String(ngnAmount || Math.ceil(usdtAmount * 1600)),
      usdtAmount: String(usdtAmount),
      rate: String(result.bestRateUsed),
      status: "AWAITING_PAYMENT",
      providerDetails: result.providerDetails,
      email: userEmail,
    });

    res.json({
      data: {
        transactionId: result.transactionId,
        requestReference: result.requestReference,
        selectedProvider: result.selectedProvider,
        providerDetails: result.providerDetails,
        ourCryptoAddress: result.ourCryptoAddress,
        tier,
        usdtAmount,
        ngnAmount: ngnAmount || Math.ceil(usdtAmount * 1600),
        status: "AWAITING_PAYMENT",
      },
    });
  } catch (e: any) {
    logger.warn({ err: e.message, userId, tier }, "RampHub order creation failed");
    res.status(500).json({ error: e.message });
  }
});

// ── Check live status of an order ──────────────────────────────
router.post("/monitor", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { transactionId } = req.body;
  if (!transactionId) {
    res.status(400).json({ error: "transactionId required" });
    return;
  }
  const [order] = await db
    .select()
    .from(ramphubOrdersTable)
    .where(eq(ramphubOrdersTable.transactionId, transactionId));
  if (!order || order.userId !== userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  try {
    const result = await monitorStatus(transactionId);
    res.json({ data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── List user's RampHub orders ──────────────────────────────────
router.get("/orders", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    const orders = await db
      .select()
      .from(ramphubOrdersTable)
      .where(eq(ramphubOrdersTable.userId, userId))
      .orderBy(desc(ramphubOrdersTable.createdAt));
    res.json({ data: orders });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
