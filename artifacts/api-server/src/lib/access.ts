import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type Plan = "beta" | "pending" | "trial" | "expired";

export function getPlanStatus(plan: string, trialEndsAt: Date | null): Plan {
  if (plan === "beta") return "beta";
  if (plan === "pending") return "pending";
  if (plan === "trial" || plan === "active") {
    if (!trialEndsAt) return "trial";
    return trialEndsAt > new Date() ? "trial" : "expired";
  }
  return "expired";
}

export function canAccessAI(plan: string, trialEndsAt: Date | null): boolean {
  const status = getPlanStatus(plan, trialEndsAt);
  return status === "beta" || status === "trial";
}

export async function requireActivePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select({ plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (!canAccessAI(user.plan, user.trialEndsAt)) {
    const status = getPlanStatus(user.plan, user.trialEndsAt);
    if (status === "pending") {
      res.status(403).json({ error: "waitlist_pending", message: "You're on the waitlist — we'll notify you when your access is approved." });
    } else {
      res.status(403).json({ error: "trial_expired", message: "Your trial has ended. Upgrade to continue using AI features." });
    }
    return;
  }

  next();
}

export function getTrialDays(): number {
  const launchDate = process.env.LAUNCH_DATE ? new Date(process.env.LAUNCH_DATE) : null;
  if (!launchDate) return 14;
  const now = new Date();
  const monthsPostLaunch = (now.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsPostLaunch <= 3) return 7;
  return 3;
}

export function trialEndsAt(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
