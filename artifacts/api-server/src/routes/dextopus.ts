import { Router } from "express";
import { db } from "@workspace/db";
import { dextopusDepositsTable } from "@workspace/db";
import { usersTable, referralsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import {
  generateStaticAddress,
  listDeposits,
  listChains,
  listTokens,
  getDestinations,
  isDextopusEnabled,
  type DextopusDepositRequest,
} from "../lib/dextopus.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Public: check if Dextopus is enabled ───────────────────────
router.get("/status", async (_req, res) => {
  res.json({ enabled: isDextopusEnabled() });
});

const DEXTOPUS_WEBHOOK_SECRET = process.env.DEXTOPUS_WEBHOOK_SECRET || "";

// ── Webhook: Dextopus sends deposit events here (PUBLIC) ──
router.post("/webhook", async (req, res) => {
  // Verify webhook signature if secret is configured
  if (DEXTOPUS_WEBHOOK_SECRET) {
    const signature = req.headers["x-dextopus-signature"] || req.headers["x-webhook-signature"] || req.headers["x-signature"];
    if (!signature) {
      logger.warn({ headers: req.headers }, "Dextopus webhook: missing signature");
      res.status(400).json({ error: "Missing signature" });
      return;
    }
    const rawBody = JSON.stringify(req.body);
    const expected = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody + DEXTOPUS_WEBHOOK_SECRET))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));
    if (Array.isArray(signature) ? signature[0] : signature !== expected) {
      logger.warn({ signature }, "Dextopus webhook: invalid signature");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  const payload = req.body;
  const eventType = payload?.event as string | undefined;
  const data = payload?.data as Record<string, unknown> | undefined;
  logger.info({ event: eventType, depositId: data?.depositId }, "Dextopus webhook received");

  if (!data?.depositId) {
    res.status(400).json({ error: "Missing depositId" });
    return;
  }

  const depositId = data.depositId as string;
  const requestId = data.requestId as string | undefined;
  const settlementAmount = data.settlementAmount as string | undefined;

  // Derive status from event type if not explicitly provided
  let status: string;
  if (eventType === "deposit.completed") {
    status = "COMPLETED";
  } else if (eventType === "deposit.failed") {
    status = "FAILED";
  } else if (eventType === "deposit.pending") {
    status = "PENDING";
  } else {
    status = (data.status as string) || "COMPLETED";
  }

  try {
    // Update our local record
    const existing = await db
      .select()
      .from(dextopusDepositsTable)
      .where(eq(dextopusDepositsTable.depositId, depositId));

    if (existing.length > 0) {
      await db
        .update(dextopusDepositsTable)
        .set({
          status,
          requestId: requestId || existing[0].requestId,
          settlementAmount: settlementAmount ? String(settlementAmount) : existing[0].settlementAmount,
          updatedAt: new Date(),
        })
        .where(eq(dextopusDepositsTable.depositId, depositId));
    }

    // If completed, activate user subscription
    if (status === "COMPLETED" && existing.length > 0) {
      const deposit = existing[0];
      const newPlan = deposit.tier === "lifetime" ? "lifetime" : "active";
      let subscriptionEndsAt: Date | null = null;

      if (deposit.tier !== "lifetime") {
        // Get the user's current subscription/trial end to extend from
        const [user] = await db
          .select({ trialEndsAt: usersTable.trialEndsAt, subscriptionEndsAt: usersTable.subscriptionEndsAt })
          .from(usersTable)
          .where(eq(usersTable.id, deposit.userId));

        const now = new Date();

        // Determine base date for extension:
        // 1. If user has an active subscription in the future, extend from that
        // 2. If trial is still running, extend from trial end
        // 3. Otherwise, extend from today (post-launch or expired)
        const baseDate = user?.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now
          ? new Date(user.subscriptionEndsAt)
          : user?.trialEndsAt && new Date(user.trialEndsAt) > now
          ? new Date(user.trialEndsAt)
          : now;

        subscriptionEndsAt = new Date(baseDate);
        if (deposit.tier === "monthly") {
          subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 31);
        } else if (deposit.tier === "yearly") {
          subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 366);
        }
      }

      await db
        .update(usersTable)
        .set({ plan: newPlan, subscriptionEndsAt, updatedAt: new Date() })
        .where(eq(usersTable.id, deposit.userId));

      // Track tier on the referral record for challenge campaigns
      if (deposit.tier === "yearly" || deposit.tier === "lifetime") {
        await db
          .update(referralsTable)
          .set({ tier: deposit.tier, referredUserPlan: newPlan, qualifies: true })
          .where(eq(referralsTable.referredUserId, deposit.userId));
      }

      logger.info(
        { userId: deposit.userId, depositId, tier: deposit.tier, plan: newPlan, subscriptionEndsAt },
        "User subscription activated after deposit"
      );
    }

    // If failed, log it (don't downgrade plan if already active)
    if (status === "FAILED" && existing.length > 0) {
      logger.warn({ userId: existing[0].userId, depositId }, "Deposit failed");
    }

    res.status(200).json({ received: true, status });
  } catch (e: any) {
    logger.error({ err: e.message }, "Dextopus webhook processing failed");
    res.status(500).json({ error: e.message });
  }
});

// ── Public: supported chains ──────────────────────────────────
router.get("/chains", async (_req, res) => {
  try {
    const chains = await listChains();
    res.json({ data: chains });
  } catch (e: any) {
    logger.warn({ err: e.message }, "Dextopus chains fetch failed");
    res.status(500).json({ error: e.message });
  }
});

// ── Public: tokens for a chain ────────────────────────────────
router.get("/tokens", async (req, res) => {
  const chainId = Number(req.query.chainId);
  if (!chainId) {
    res.status(400).json({ error: "chainId required" });
    return;
  }
  try {
    const tokens = await listTokens(chainId);
    res.json({ data: tokens });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

// ── Auth required from here ───────────────────────────────────
router.use(requireAuth);

// ── Get destinations for an origin token ──────────────────────
router.get("/destinations", async (req, res) => {
  const originChainId = Number(req.query.originChainId);
  const originAddress = req.query.originAddress as string;
  if (!originChainId || !originAddress) {
    res.status(400).json({ error: "originChainId and originAddress required" });
    return;
  }
  try {
    const destinations = await getDestinations(originChainId, originAddress);
    res.json({ data: destinations });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

// ── Generate a deposit address for a subscription tier ──
const TIER_AMOUNTS: Record<string, string> = {
  monthly: "5",
  yearly: "45",
  lifetime: "250",
};

const TREASURY_WALLET = process.env.TREASURY_WALLET_ADDRESS || "";

router.post("/checkout", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const {
    tier,
    originChainId,
    originAsset,
    refundTo,
  } = req.body;

  if (!tier || !originChainId || !originAsset) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (!TIER_AMOUNTS[tier]) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  try {
    const dextReq: DextopusDepositRequest = {
      userId: String(userId),
      originChainId: Number(originChainId),
      originAsset: String(originAsset),
      settlementChainId: 8453, // Base
      settlementAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      settlementAddress: TREASURY_WALLET,
      refundTo: refundTo ? String(refundTo) : undefined,
    };

    const result = await generateStaticAddress(dextReq);

    // Store in our database
    await db.insert(dextopusDepositsTable).values({
      userId,
      tier,
      depositId: result.depositId,
      requestId: result.requestId,
      originChainId: dextReq.originChainId,
      originAsset: dextReq.originAsset,
      settlementChainId: dextReq.settlementChainId,
      settlementAsset: dextReq.settlementAsset,
      settlementAddress: dextReq.settlementAddress,
      depositAddress: result.depositAddress,
      expectedAmount: TIER_AMOUNTS[tier],
      status: "PENDING",
      refundTo: dextReq.refundTo,
    });

    res.json({
      data: {
        depositId: result.depositId,
        requestId: result.requestId,
        depositAddress: result.depositAddress,
        tier,
        expectedAmount: TIER_AMOUNTS[tier],
        status: "PENDING",
      },
    });
    return;
  } catch (e: any) {
    logger.warn({ err: e.message, userId }, "Dextopus checkout failed");
    res.status(500).json({ error: e.message });
    return;
  }
});

// ── Confirm payment sent (record tx hash) ────────────────
router.post("/confirm", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const { depositId, depositAddress, txHash } = req.body;

  if (!txHash) {
    res.status(400).json({ error: "txHash is required" });
    return;
  }

  try {
    let deposit;

    if (depositId) {
      // Preferred: look up by depositId
      [deposit] = await db
        .select()
        .from(dextopusDepositsTable)
        .where(eq(dextopusDepositsTable.depositId, String(depositId)));
    } else if (depositAddress) {
      // Fallback: look up by deposit address
      [deposit] = await db
        .select()
        .from(dextopusDepositsTable)
        .where(eq(dextopusDepositsTable.depositAddress, String(depositAddress)));
    } else {
      // Last resort: most recent pending deposit for this user
      [deposit] = await db
        .select()
        .from(dextopusDepositsTable)
        .where(eq(dextopusDepositsTable.userId, userId))
        .orderBy(desc(dextopusDepositsTable.createdAt))
        .limit(1);
    }

    if (!deposit || deposit.userId !== userId) {
      res.status(404).json({ error: "Deposit not found" });
      return;
    }

    await db
      .update(dextopusDepositsTable)
      .set({ txHash: String(txHash), notes: `User confirmed payment. TxHash: ${txHash}` })
      .where(eq(dextopusDepositsTable.id, deposit.id));

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get user's active subscription status ───────────────
router.get("/subscription", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    // Check for any completed deposits
    const deposits = await db
      .select()
      .from(dextopusDepositsTable)
      .where(eq(dextopusDepositsTable.userId, userId));

    const active = deposits
      .filter(d => d.status === "COMPLETED")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    // Also get user record for subscriptionEndsAt
    const [user] = await db
      .select({ subscriptionEndsAt: usersTable.subscriptionEndsAt })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    res.json({
      subscription: active
        ? {
            tier: active.tier,
            status: "active",
            depositId: active.depositId,
            settlementAmount: active.settlementAmount,
            completedAt: active.updatedAt,
            subscriptionEndsAt: user?.subscriptionEndsAt,
          }
        : null,
      pending: deposits
        .filter(d => d.status === "PENDING")
        .map(d => ({
          depositId: d.depositId,
          depositAddress: d.depositAddress,
          tier: d.tier,
          status: d.status,
          createdAt: d.createdAt,
        })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── List user deposits ────────────────────────────────────────
router.get("/deposits", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    const local = await db
      .select()
      .from(dextopusDepositsTable)
      .where(eq(dextopusDepositsTable.userId, userId));
    res.json({ data: local });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
