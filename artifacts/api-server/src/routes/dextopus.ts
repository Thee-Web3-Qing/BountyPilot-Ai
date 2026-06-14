import { Router } from "express";
import { db } from "@workspace/db";
import { dextopusDepositsTable } from "@workspace/db";
import { usersTable } from "@workspace/db";
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

router.post("/checkout", async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const {
    tier,
    originChainId,
    originAsset,
    settlementChainId,
    settlementAsset,
    settlementAddress,
    refundTo,
  } = req.body;

  if (!tier || !originChainId || !originAsset || !settlementChainId || !settlementAsset || !settlementAddress) {
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
      settlementChainId: Number(settlementChainId),
      settlementAsset: String(settlementAsset),
      settlementAddress: String(settlementAddress),
      refundTo: refundTo ? String(refundTo) : undefined,
    };

    const result = await generateStaticAddress(dextReq);

    // Store in our database
    await db.insert(dextopusDepositsTable).values({
      userId,
      tier,
      depositId: result.depositId,
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

    res.json({
      subscription: active
        ? {
            tier: active.tier,
            status: "active",
            depositId: active.depositId,
            settlementAmount: active.settlementAmount,
            completedAt: active.updatedAt,
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
