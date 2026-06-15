import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { getTrialDays, trialEndsAt, getPlanStatus } from "../lib/access.js";
import { sendOTPEmail } from "../lib/email.js";

export const authRouter = Router();

// POST /auth/signup
authRouter.post("/signup", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ error: "email, username, and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const existingUsername = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));
    if (existingUsername.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const plan = "trial";
    const HACKATHON_DEADLINE = new Date("2026-08-07T20:00:00Z");
    const now = new Date();
    // Before Aug 7: open access until hackathon closes. After Aug 7: 7-day trial.
    const trialEnd = now < HACKATHON_DEADLINE
      ? HACKATHON_DEADLINE
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), username, passwordHash, plan, trialEndsAt: trialEnd })
      .returning();

    // Create empty profile
    await db.insert(userProfilesTable).values({ userId: user.id });

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id, plan }, "User signed up");
    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: user.subscriptionEndsAt, isAdmin: user.isAdmin } });
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
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id }, "User logged in");
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: user.subscriptionEndsAt, isAdmin: user.isAdmin } });
  } catch (err) {
    logger.error(err, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /auth/login-otp/request — send OTP to email
authRouter.post("/login-otp/request", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      res.status(404).json({ error: "No account found with that email" });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db
      .update(usersTable)
      .set({ loginCode: code, loginCodeExpires: expiresAt })
      .where(eq(usersTable.id, user.id));

    const { sent } = await sendOTPEmail(user.email, code, "login");

    logger.info({ userId: user.id, email: user.email, sent }, "Login OTP requested");
    res.json({
      message: "Login code sent to your email",
      code: sent ? undefined : code, // Show code in dev mode if email didn't send
      sent,
    });
  } catch (err) {
    logger.error(err, "Login OTP request error");
    res.status(500).json({ error: "Failed to send login code" });
  }
});

// POST /auth/login-otp/verify — verify OTP and return token
authRouter.post("/login-otp/verify", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "Email and code are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user || user.loginCode !== code || !user.loginCodeExpires) {
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    if (new Date() > user.loginCodeExpires) {
      res.status(400).json({ error: "Code has expired" });
      return;
    }

    // Clear the code
    await db
      .update(usersTable)
      .set({ loginCode: null, loginCodeExpires: null })
      .where(eq(usersTable.id, user.id));

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id }, "User logged in via OTP");
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        plan: user.plan,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    logger.error(err, "Login OTP verify error");
    res.status(500).json({ error: "Failed to verify code" });
  }
});

// POST /auth/forgot-password
authRouter.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      // Don't reveal if email exists
      res.json({ message: "If an account exists, a reset code has been generated." });
      return;
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(usersTable)
      .set({ passwordResetToken: code, passwordResetExpires: expiresAt })
      .where(eq(usersTable.id, user.id));

    const { sent } = await sendOTPEmail(user.email, code, "reset");

    logger.info({ userId: user.id, email: user.email, sent }, "Password reset code generated");
    res.json({ message: "Reset code generated", code: sent ? undefined : code, username: user.username, sent });
  } catch (err) {
    logger.error(err, "Forgot password error");
    res.status(500).json({ error: "Failed to process request" });
  }
});

// POST /auth/reset-password
authRouter.post("/reset-password", async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
      res.status(400).json({ error: "Email, code, and new password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user || user.passwordResetToken !== code || !user.passwordResetExpires) {
      res.status(400).json({ error: "Invalid or expired reset code" });
      return;
    }

    if (new Date() > user.passwordResetExpires) {
      res.status(400).json({ error: "Reset code has expired" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(usersTable)
      .set({ passwordHash, passwordResetToken: null, passwordResetExpires: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    logger.info({ userId: user.id }, "Password reset successful");
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    logger.error(err, "Reset password error");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// GET /auth/me
authRouter.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, createdAt: usersTable.createdAt, plan: usersTable.plan, trialEndsAt: usersTable.trialEndsAt, subscriptionEndsAt: usersTable.subscriptionEndsAt, isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, req.user!.userId));

    res.json({ ...user, profile: profile || null });
    return;
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
