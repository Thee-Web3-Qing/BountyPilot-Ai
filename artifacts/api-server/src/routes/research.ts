import { Router } from "express";
import { db } from "@workspace/db";
import { researchBriefsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export const researchRouter = Router();

// GET /research-briefs
researchRouter.get("/", async (_req, res) => {
  try {
    const briefs = await db.select().from(researchBriefsTable);
    res.json(briefs);
  } catch (err) {
    logger.error(err, "Error listing research briefs");
    res.status(500).json({ error: "Failed to list research briefs" });
  }
});

// GET /research-briefs/:id
researchRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [brief] = await db.select().from(researchBriefsTable).where(eq(researchBriefsTable.id, id));
    if (!brief) return res.status(404).json({ error: "Not found" });
    res.json(brief);
  } catch (err) {
    logger.error(err, "Error getting research brief");
    res.status(500).json({ error: "Failed to get research brief" });
  }
});

// GET /research-briefs/bounty/:bountyId
researchRouter.get("/bounty/:bountyId", async (req, res) => {
  try {
    const bountyId = parseInt(req.params.bountyId);
    const [brief] = await db
      .select()
      .from(researchBriefsTable)
      .where(eq(researchBriefsTable.bountyId, bountyId));
    if (!brief) return res.status(404).json({ error: "Not found" });
    res.json(brief);
  } catch (err) {
    logger.error(err, "Error getting research brief by bounty");
    res.status(500).json({ error: "Failed to get research brief" });
  }
});
