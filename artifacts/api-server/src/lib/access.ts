import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";
import { db } from "@workspace/db";
import { usersTable, bountiesTable } from "@workspace/db";
import { eq, count, and } from "drizzle-orm";

export type Plan = "beta" | "pending" | "trial" | "expired" | "active" | "lifetime";

const HACKATHON_DEADLINE = new Date("2026-08-07T20:00:00Z"); // Aug 7 10pm GMT+1
const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
const GRACE_END = new Date(HACKATHON_DEADLINE.getTime() + GRACE_MS); // Aug 10

// Pre-hackathon users (trialEndsAt == Aug 7) get a 3-day grace period after Aug 7.
// Post-hackathon users have their own trialEndsAt (now + 7 days at signup).
function effectiveTrialEnd(trialEndsAt: Date | null): Date | null {
  if (!trialEndsAt) return null;
  const endsAt = new Date(trialEndsAt);
  const now = new Date();
  if (endsAt.getTime() <= HACKATHON_DEADLINE.getTime() + 60_000 && now > HACKATHON_DEADLINE) {
    return GRACE_END;
  }
  return endsAt;
}

export function getPlanStatus(plan: string, trialEndsAt: Date | null): Plan {
  if (plan === "beta") return "beta";
  if (plan === "active" || plan === "lifetime") return "active";
  if (plan === "trial" || plan === "pending") {
    const effEnd = effectiveTrialEnd(trialEndsAt);
    if (!effEnd) return "trial";
    return effEnd > new Date() ? "trial" : "expired";
  }
  return "expired";
}

export function canAccessAI(plan: string, trialEndsAt: Date | null): boolean {
  const status = getPlanStatus(plan, trialEndsAt);
  return status === "beta" || status === "trial" || status === "active";
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
    res.status(403).json({ error: "trial_expired", message: "Your trial has ended. Subscription coming soon." });
    return;
  }

  next();
}

export function isFreeTier(plan: string, trialEndsAt: Date | null): boolean {
  const status = getPlanStatus(plan, trialEndsAt);
  return status === "trial" || status === "pending" || status === "expired";
}

export async function getUserPlanStatus(userId: number): Promise<{ plan: string; trialEndsAt: Date | null; isFree: boolean }> {
  const [user] = await db
    .select({ plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user) return { plan: "expired", trialEndsAt: null, isFree: true };
  return { plan: user.plan, trialEndsAt: user.trialEndsAt, isFree: isFreeTier(user.plan, user.trialEndsAt) };
}

export async function countUserBounties(userId: number): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(bountiesTable)
    .where(eq(bountiesTable.userId, userId));
  return Number(result?.value ?? 0);
}

export function getTrialDays(): number {
  return 7;
}

export function trialEndsAt(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
