import { Router } from "express";
import { db } from "@workspace/db";
import { submissionsTable, bountiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateSubmissionBody, UpdateSubmissionBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

export const submissionsRouter = Router();

// GET /submissions
submissionsRouter.get("/", async (_req, res) => {
  try {
    const submissions = await db.select().from(submissionsTable);
    res.json(submissions);
  } catch (err) {
    logger.error(err, "Error listing submissions");
    res.status(500).json({ error: "Failed to list submissions" });
  }
});

// POST /submissions
submissionsRouter.post("/", async (req, res) => {
  try {
    const parsed = CreateSubmissionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error });
    }
    const { bountyId, submittedAt, submissionUrl, notes } = parsed.data;

    // Update bounty status to submitted
    await db
      .update(bountiesTable)
      .set({ status: "submitted" })
      .where(eq(bountiesTable.id, bountyId));

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        bountyId,
        submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
        submissionUrl: submissionUrl ?? null,
        notes: notes ?? null,
        result: "pending",
      })
      .returning();

    res.status(201).json(submission);
  } catch (err) {
    logger.error(err, "Error creating submission");
    res.status(500).json({ error: "Failed to create submission" });
  }
});

// PATCH /submissions/:id
submissionsRouter.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parsed = UpdateSubmissionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.result !== undefined) updates.result = parsed.data.result;
    if (parsed.data.rewardReceived !== undefined) updates.rewardReceived = parsed.data.rewardReceived;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.submissionUrl !== undefined) updates.submissionUrl = parsed.data.submissionUrl;

    const [submission] = await db
      .update(submissionsTable)
      .set(updates)
      .where(eq(submissionsTable.id, id))
      .returning();

    if (!submission) return res.status(404).json({ error: "Not found" });

    // Update bounty status based on result
    if (parsed.data.result === "won") {
      await db
        .update(bountiesTable)
        .set({ status: "won" })
        .where(eq(bountiesTable.id, submission.bountyId));
    } else if (parsed.data.result === "lost") {
      await db
        .update(bountiesTable)
        .set({ status: "lost" })
        .where(eq(bountiesTable.id, submission.bountyId));
    }

    res.json(submission);
  } catch (err) {
    logger.error(err, "Error updating submission");
    res.status(500).json({ error: "Failed to update submission" });
  }
});
