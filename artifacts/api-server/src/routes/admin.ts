import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, waitlistTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { trialEndsAt } from "../lib/access.js";

export const adminRouter = Router();

async function requireAdmin(req: AuthRequest, res: any, next: any) {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.user.userId));
  if (!user?.isAdmin) { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}

adminRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [wlCount] = await db.select({ value: count() }).from(waitlistTable);
    const allUsers = await db.select({ plan: usersTable.plan }).from(usersTable);
    const stats = {
      waitlistSignups: Number(wlCount?.value ?? 0),
      beta: allUsers.filter(u => u.plan === "beta").length,
      pending: allUsers.filter(u => u.plan === "pending").length,
      trial: allUsers.filter(u => u.plan === "trial").length,
      expired: allUsers.filter(u => u.plan === "expired").length,
      total: allUsers.length,
    };
    res.json(stats);
  } catch (err) {
    logger.error(err, "Admin stats error");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

adminRouter.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        plan: usersTable.plan,
        trialEndsAt: usersTable.trialEndsAt,
        approvedAt: usersTable.approvedAt,
        isAdmin: usersTable.isAdmin,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json(users);
  } catch (err) {
    logger.error(err, "Admin users error");
    res.status(500).json({ error: "Failed to get users" });
  }
});

adminRouter.get("/waitlist", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const entries = await db.select().from(waitlistTable).orderBy(waitlistTable.createdAt);
    res.json(entries);
  } catch (err) {
    logger.error(err, "Admin waitlist error");
    res.status(500).json({ error: "Failed to get waitlist" });
  }
});

adminRouter.post("/approve/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const ends = trialEndsAt(14);
    const [user] = await db
      .update(usersTable)
      .set({ plan: "trial", trialEndsAt: ends, approvedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt });
    if (!user) return res.status(404).json({ error: "User not found" });
    logger.info({ userId, trialEndsAt: ends }, "User approved for 14-day trial");
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin approve error");
    res.status(500).json({ error: "Failed to approve user" });
  }
});

adminRouter.post("/beta/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [betaCount] = await db.select({ value: count() }).from(usersTable).where(eq(usersTable.plan, "beta"));
    if (Number(betaCount?.value ?? 0) >= 30) {
      return res.status(400).json({ error: "Beta is full (30 creators max)" });
    }
    const [user] = await db
      .update(usersTable)
      .set({ plan: "beta", trialEndsAt: null, approvedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) return res.status(404).json({ error: "User not found" });
    logger.info({ userId }, "User promoted to beta");
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin beta error");
    res.status(500).json({ error: "Failed to promote to beta" });
  }
});

adminRouter.post("/revoke/:userId", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const [user] = await db
      .update(usersTable)
      .set({ plan: "expired" })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email, plan: usersTable.plan });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    logger.error(err, "Admin revoke error");
    res.status(500).json({ error: "Failed to revoke access" });
  }
});
