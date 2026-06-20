import { Router } from "express";
import { db } from "@workspace/db";
import { bountyEntriesTable, bountiesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

export const bountyEntriesRouter = Router();
bountyEntriesRouter.use(requireAuth);

// POST /bounty-entries — submit an entry for a bounty
bountyEntriesRouter.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { bountyId, xHandle, xPostUrl, contentType, walletAddress, notes } = req.body as {
      bountyId: number;
      xHandle: string;
      xPostUrl: string;
      contentType?: string;
      walletAddress?: string;
      notes?: string;
    };

    if (!bountyId || !xHandle?.trim() || !xPostUrl?.trim()) {
      res.status(400).json({ error: "bountyId, xHandle, and xPostUrl are required" });
      return;
    }

    // Validate X post URL format
    const isXUrl = /^https?:\/\/(x\.com|twitter\.com)\/.+/.test(xPostUrl.trim());
    if (!isXUrl) {
      res.status(400).json({ error: "xPostUrl must be a valid x.com or twitter.com link" });
      return;
    }

    // Check bounty exists
    const [bounty] = await db.select({ id: bountiesTable.id }).from(bountiesTable).where(eq(bountiesTable.id, bountyId)).limit(1);
    if (!bounty) {
      res.status(404).json({ error: "Bounty not found" });
      return;
    }

    // Prevent duplicate entries for same user + bounty
    const [existing] = await db
      .select({ id: bountyEntriesTable.id })
      .from(bountyEntriesTable)
      .where(and(eq(bountyEntriesTable.bountyId, bountyId), eq(bountyEntriesTable.userId, userId)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "You already submitted an entry for this bounty" });
      return;
    }

    const [entry] = await db.insert(bountyEntriesTable).values({
      bountyId,
      userId,
      xHandle: xHandle.trim().replace(/^@/, ""),
      xPostUrl: xPostUrl.trim(),
      contentType: contentType ?? null,
      walletAddress: walletAddress?.trim() ?? null,
      notes: notes?.trim() ?? null,
      status: "submitted",
    }).returning();

    logger.info({ bountyId, userId, entryId: entry.id }, "Bounty entry submitted");
    res.status(201).json({ ok: true, entry });
  } catch (err) {
    logger.error(err, "Error submitting bounty entry");
    res.status(500).json({ error: "Failed to submit entry" });
  }
});

// GET /bounty-entries?bountyId=X — check if current user already submitted
bountyEntriesRouter.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const bountyId = Number(req.query.bountyId);
    if (!bountyId) {
      res.status(400).json({ error: "bountyId required" });
      return;
    }
    const [entry] = await db
      .select()
      .from(bountyEntriesTable)
      .where(and(eq(bountyEntriesTable.bountyId, bountyId), eq(bountyEntriesTable.userId, userId)))
      .limit(1);
    res.json({ entry: entry ?? null });
  } catch (err) {
    logger.error(err, "Error fetching bounty entry");
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});
