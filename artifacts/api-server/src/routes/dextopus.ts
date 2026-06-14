import { Router } from "express";
import { db } from "@workspace/db";
import { dextopusDepositsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

// ── Auth required from here ───────────────────────────────────
router.use(requireAuth);

// ── List supported chains ─────────────────────────────────────
router.get("/chains", async (_req, res) => {
  try {
    const chains = await listChains();
    res.json({ data: chains });
  } catch (e: any) {
    logger.warn({ err: e.message }, "Dextopus chains fetch failed");
    res.status(500).json({ error: e.message });
  }
});

// ── List tokens for a chain ───────────────────────────────────
router.get("/tokens", async (req, res) => {
  const chainId = Number(req.query.chainId);
  if (!chainId) return res.status(400).json({ error: "chainId required" });
  try {
    const tokens = await listTokens(chainId);
    res.json({ data: tokens });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Get destinations for an origin token ──────────────────────
router.get("/destinations", async (req, res) => {
  const originChainId = Number(req.query.originChainId);
  const originAddress = req.query.originAddress as string;
  if (!originChainId || !originAddress) {
    return res.status(400).json({ error: "originChainId and originAddress required" });
  }
  try {
    const destinations = await getDestinations(originChainId, originAddress);
    res.json({ data: destinations });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Generate a static deposit address for subscription payment ─
router.post("/generate", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const {
    originChainId,
    originAsset,
    settlementChainId,
    settlementAsset,
    settlementAddress,
    refundTo,
  } = req.body;

  if (!originChainId || !originAsset || !settlementChainId || !settlementAsset || !settlementAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const dextReq: DextopusDepositRequest = {
      userId: String(userId),
      originChainId: Number(originChainId),
      originAsset: String(originAsset),
      settlementChainId: Number(settlementChainId),
      settlementAsset: String(settlementAsset),
      settlementAddress: String(settlementAddress),
      refundTo: refundTo ? String(refundTo) : undefined,
    };

    const result = await generateStaticAddress(dextReq);

    // Store in our database
    await db.insert(dextopusDepositsTable).values({
      userId,
      depositId: result.depositId,
      originChainId: dextReq.originChainId,
      originAsset: dextReq.originAsset,
      settlementChainId: dextReq.settlementChainId,
      settlementAsset: dextReq.settlementAsset,
      settlementAddress: dextReq.settlementAddress,
      depositAddress: result.depositAddress,
      status: "PENDING",
      refundTo: dextReq.refundTo,
    });

    res.json({ data: result });
  } catch (e: any) {
    logger.warn({ err: e.message, userId }, "Dextopus generate failed");
    res.status(500).json({ error: e.message });
  }
});

// ── List user deposits ────────────────────────────────────────
router.get("/deposits", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  try {
    // Try to sync from Dextopus API
    const apiDeposits = await listDeposits(String(userId));
    
    // Also get local records
    const local = await db.select().from(dextopusDepositsTable).where(eq(dextopusDepositsTable.userId, userId));
    
    // Merge: prefer API data for status, keep local for anything not in API
    const apiIds = new Set(apiDeposits.map(d => d.depositId));
    const merged = [
      ...apiDeposits.map(d => ({
        depositId: d.depositId,
        depositAddress: d.depositAddress,
        originChainId: d.originChainId,
        originAsset: d.originAsset,
        settlementChainId: d.settlementChainId,
        settlementAsset: d.settlementAsset,
        settlementAddress: d.settlementAddress,
        status: d.status,
        settlementAmount: d.settlementAmount,
        createdAt: d.createdAt,
      })),
      ...local.filter(l => !apiIds.has(l.depositId)).map(l => ({
        depositId: l.depositId,
        depositAddress: l.depositAddress,
        originChainId: l.originChainId,
        settlementChainId: l.settlementChainId,
        settlementAsset: l.settlementAsset,
        settlementAddress: l.settlementAddress,
        status: l.status,
        settlementAmount: l.settlementAmount,
        createdAt: l.createdAt?.toISOString(),
      })),
    ];

    res.json({ data: merged });
  } catch (e: any) {
    // Fallback to local only
    const local = await db.select().from(dextopusDepositsTable).where(eq(dextopusDepositsTable.userId, userId));
    res.json({ data: local });
  }
});

// ── Webhook: Dextopus sends deposit events here ───────────────
router.post("/webhook", async (req, res) => {
  const payload = req.body;
  logger.info({ event: payload?.event, depositId: payload?.data?.depositId }, "Dextopus webhook received");

  if (!payload?.data?.depositId) {
    return res.status(400).json({ error: "Missing depositId" });
  }

  const { depositId, userId, status, requestId, settlementAmount } = payload.data;

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
          status: status || "COMPLETED",
          requestId: requestId || existing[0].requestId,
          settlementAmount: settlementAmount ? String(settlementAmount) : existing[0].settlementAmount,
          updatedAt: new Date(),
        })
        .where(eq(dextopusDepositsTable.depositId, depositId));
    }

    // If completed, activate user subscription
    if (status === "COMPLETED" && existing.length > 0) {
      // Note: actual subscription activation depends on business logic
      // Could be done via Stripe or direct DB update
      logger.info({ userId: existing[0].userId, depositId }, "Deposit completed — consider activating subscription");
    }

    res.status(200).json({ received: true });
  } catch (e: any) {
    logger.error({ err: e.message }, "Dextopus webhook processing failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
