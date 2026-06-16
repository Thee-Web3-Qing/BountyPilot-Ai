import { Router } from "express";
import { db } from "@workspace/db";
import { customBountiesTable, customBountyApplicationsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { sendLaunchpadStatusEmail } from "../lib/email.js";

export const customBountiesRouter = Router();

// GET /custom-bounties — list open bounties
customBountiesRouter.get("/", async (_req, res) => {
  try {
    const bounties = await db
      .select()
      .from(customBountiesTable)
      .where(eq(customBountiesTable.status, "open"))
      .orderBy(desc(customBountiesTable.featured), desc(customBountiesTable.createdAt));
    res.json(bounties);
  } catch (err) {
    logger.error(err, "List custom bounties error");
    res.status(500).json({ error: "Failed to get bounties" });
  }
});

// GET /custom-bounties/all — admin: all bounties
customBountiesRouter.get("/all", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const bounties = await db
      .select()
      .from(customBountiesTable)
      .orderBy(desc(customBountiesTable.createdAt));
    res.json(bounties);
  } catch (err) {
    res.status(500).json({ error: "Failed to get bounties" });
  }
});

// POST /custom-bounties — admin: create bounty
customBountiesRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { title, description, requirements, reward, rewardToken, rewardType, category, maxParticipants, deadline, featured } = req.body;
    if (!title || !description || !reward) {
      res.status(400).json({ error: "title, description, and reward are required" });
      return;
    }
    const [bounty] = await db.insert(customBountiesTable).values({
      title, description, requirements, reward: String(reward),
      rewardToken: rewardToken || "USDC",
      rewardType: rewardType || "crypto",
      category: category || "content",
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      deadline: deadline ? new Date(deadline) : null,
      featured: featured ?? false,
      postedById: req.user!.userId,
    }).returning();
    logger.info({ bountyId: bounty.id }, "Custom bounty created");
    res.status(201).json(bounty);
  } catch (err) {
    logger.error(err, "Create custom bounty error");
    res.status(500).json({ error: "Failed to create bounty" });
  }
});

// PUT /custom-bounties/:id — admin: update bounty
customBountiesRouter.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const id = parseInt(req.params.id as string);
    const { title, description, requirements, reward, rewardToken, rewardType, category, maxParticipants, deadline, status, featured } = req.body;
    const [updated] = await db.update(customBountiesTable)
      .set({
        ...(title && { title }),
        ...(description && { description }),
        ...(requirements !== undefined && { requirements }),
        ...(reward && { reward: String(reward) }),
        ...(rewardToken && { rewardToken }),
        ...(rewardType && { rewardType }),
        ...(category && { category }),
        ...(maxParticipants !== undefined && { maxParticipants: maxParticipants ? parseInt(maxParticipants) : null }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(status && { status }),
        ...(featured !== undefined && { featured }),
        updatedAt: new Date(),
      })
      .where(eq(customBountiesTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    logger.error(err, "Update custom bounty error");
    res.status(500).json({ error: "Failed to update bounty" });
  }
});

// DELETE /custom-bounties/:id — admin
customBountiesRouter.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    await db.delete(customBountiesTable).where(eq(customBountiesTable.id, parseInt(req.params.id as string)));
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete bounty" });
  }
});

// GET /custom-bounties/:id — single bounty
customBountiesRouter.get("/:id", async (req, res) => {
  try {
    const [bounty] = await db.select().from(customBountiesTable).where(eq(customBountiesTable.id, parseInt(req.params.id as string)));
    if (!bounty) { res.status(404).json({ error: "Not found" }); return; }
    res.json(bounty);
  } catch (err) {
    res.status(500).json({ error: "Failed to get bounty" });
  }
});

// POST /custom-bounties/:id/apply — user applies
customBountiesRouter.post("/:id/apply", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bountyId = parseInt(req.params.id as string);
    const userId = req.user!.userId;
    const { submissionNote, submissionUrl } = req.body;

    const [bounty] = await db.select().from(customBountiesTable).where(eq(customBountiesTable.id, bountyId));
    if (!bounty || bounty.status !== "open") {
      res.status(400).json({ error: "Bounty is not open" }); return;
    }

    const existing = await db.select({ id: customBountyApplicationsTable.id })
      .from(customBountyApplicationsTable)
      .where(and(eq(customBountyApplicationsTable.bountyId, bountyId), eq(customBountyApplicationsTable.userId, userId)));
    if (existing.length > 0) {
      res.status(409).json({ error: "Already applied to this bounty" }); return;
    }

    const [app] = await db.insert(customBountyApplicationsTable).values({
      bountyId, userId, submissionNote, submissionUrl,
    }).returning();
    logger.info({ bountyId, userId }, "Custom bounty application submitted");
    res.status(201).json(app);
  } catch (err) {
    logger.error(err, "Apply to custom bounty error");
    res.status(500).json({ error: "Failed to apply" });
  }
});

// GET /custom-bounties/:id/applications — admin: list applications
customBountiesRouter.get("/:id/applications", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const bountyId = parseInt(req.params.id as string);
    const apps = await db
      .select({
        id: customBountyApplicationsTable.id,
        status: customBountyApplicationsTable.status,
        submissionNote: customBountyApplicationsTable.submissionNote,
        submissionUrl: customBountyApplicationsTable.submissionUrl,
        adminNote: customBountyApplicationsTable.adminNote,
        createdAt: customBountyApplicationsTable.createdAt,
        userId: customBountyApplicationsTable.userId,
        username: usersTable.username,
        email: usersTable.email,
      })
      .from(customBountyApplicationsTable)
      .innerJoin(usersTable, eq(usersTable.id, customBountyApplicationsTable.userId))
      .where(eq(customBountyApplicationsTable.bountyId, bountyId))
      .orderBy(desc(customBountyApplicationsTable.createdAt));
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: "Failed to get applications" });
  }
});

// PATCH /custom-bounties/:id/applications/:appId — admin: update application status
customBountiesRouter.patch("/:id/applications/:appId", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user!.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const bountyId = parseInt(req.params.id as string);
    const appId = parseInt(req.params.appId as string);
    const { status, adminNote } = req.body;

    const [updated] = await db.update(customBountyApplicationsTable)
      .set({ status, adminNote, updatedAt: new Date() })
      .where(eq(customBountyApplicationsTable.id, appId))
      .returning();

    res.json(updated);

    if (status === "approved" || status === "rejected") {
      try {
        const [bounty] = await db.select({ title: customBountiesTable.title })
          .from(customBountiesTable)
          .where(eq(customBountiesTable.id, bountyId));

        const [applicant] = await db.select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, updated.userId));

        if (bounty && applicant?.email) {
          await sendLaunchpadStatusEmail(applicant.email, {
            bountyTitle: bounty.title,
            status,
            adminNote: adminNote || null,
          });
          logger.info({ appId, status, to: applicant.email }, "Launchpad status email sent");
        }
      } catch (emailErr) {
        logger.error({ err: emailErr, appId }, "Failed to send launchpad status email");
      }
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to update application" });
  }
});

// GET /custom-bounties/my/applications — user's applications
customBountiesRouter.get("/my/applications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const apps = await db
      .select({
        id: customBountyApplicationsTable.id,
        status: customBountyApplicationsTable.status,
        submissionNote: customBountyApplicationsTable.submissionNote,
        submissionUrl: customBountyApplicationsTable.submissionUrl,
        adminNote: customBountyApplicationsTable.adminNote,
        createdAt: customBountyApplicationsTable.createdAt,
        bountyId: customBountyApplicationsTable.bountyId,
        bountyTitle: customBountiesTable.title,
        bountyReward: customBountiesTable.reward,
        bountyRewardToken: customBountiesTable.rewardToken,
      })
      .from(customBountyApplicationsTable)
      .innerJoin(customBountiesTable, eq(customBountiesTable.id, customBountyApplicationsTable.bountyId))
      .where(eq(customBountyApplicationsTable.userId, userId))
      .orderBy(desc(customBountyApplicationsTable.createdAt));
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: "Failed to get applications" });
  }
});
