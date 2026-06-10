import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { getTrialDays, trialEndsAt, getPlanStatus } from "../lib/access.js";

export const authRouter = Router();

// POST /auth/signup
authRouter.post("/signup", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: "email, username, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const existingUsername = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existingUsername.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // All signups get full trial access until hackathon judging closes
    const plan = "trial";
    const trialEnd = new Date("2026-08-07T20:00:00Z"); // Aug 7 10pm GMT+1

    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), username, passwordHash, plan, trialEndsAt: trialEnd })
      .returning();

    // Create empty profile
    await db.insert(userProfilesTable).values({ userId: user.id });

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id, plan }, "User signed up");
    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan, trialEndsAt: user.trialEndsAt, isAdmin: user.isAdmin } });
  } catch (err) {
    logger.error(err, "Signup error");
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /auth/login
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id }, "User logged in");
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan, trialEndsAt: user.trialEndsAt, isAdmin: user.isAdmin } });
  } catch (err) {
    logger.error(err, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /auth/me
authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, createdAt: usersTable.createdAt, plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt, isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user!.userId));

    res.json({ ...user, profile: profile || null });
  } catch (err) {
    logger.error(err, "Get me error");
    res.status(500).json({ error: "Failed to get user" });
  }
});

// PUT /auth/profile
authRouter.put("/profile", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const {
      fullName, creatorName, mainPlatforms, contentFormats, niche,
      skillLevel, preferredBountyTypes, minimumReward, weeklyContentCapacity,
      targetMonthlyEarnings, creatorStrengths, creatorWeaknesses,
      portfolioLinks, notes,
    } = req.body;

    const existing = await db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));

    const profileData = {
      fullName, creatorName, mainPlatforms, contentFormats, niche,
      skillLevel, preferredBountyTypes,
      minimumReward: minimumReward ? parseFloat(minimumReward) : undefined,
      weeklyContentCapacity: weeklyContentCapacity ? parseInt(weeklyContentCapacity) : undefined,
      targetMonthlyEarnings: targetMonthlyEarnings ? parseFloat(targetMonthlyEarnings) : undefined,
      creatorStrengths, creatorWeaknesses, portfolioLinks, notes,
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(userProfilesTable)
        .set({ ...profileData, updatedAt: new Date() })
        .where(eq(userProfilesTable.userId, userId))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(userProfilesTable)
        .values({ userId, ...profileData })
        .returning();
      res.json(created);
    }
  } catch (err) {
    logger.error(err, "Profile update error");
    res.status(500).json({ error: "Failed to update profile" });
  }
});
