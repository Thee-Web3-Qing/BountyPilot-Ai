import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { db } from "@workspace/db";
import { usersTable, userProfilesTable, referralsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { getTrialDays, trialEndsAt, getPlanStatus } from "../lib/access.js";
import { sendOTPEmail } from "../lib/email.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateReferralCode(username: string): string {
  // Referral code IS the username — exact match, no transformation
  return username;
}

async function recordReferral(refParam: string | undefined, newUserId: number) {
  if (!refParam) return;
  try {
    // Look up referrer by username (case-insensitive) or by referral_code (case-insensitive)
    const [referrer] = await db.select({ id: usersTable.id }).from(usersTable).where(
      or(ilike(usersTable.username, refParam), ilike(usersTable.referralCode, refParam))
    );
    if (!referrer || referrer.id === newUserId) return;
    await db.insert(referralsTable).values({ referrerId: referrer.id, referredUserId: newUserId }).onConflictDoNothing();
    await db.update(usersTable).set({ referredBy: referrer.id }).where(eq(usersTable.id, newUserId));
  } catch { /* non-fatal */ }
}

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
    const trialEnd = now < HACKATHON_DEADLINE
      ? HACKATHON_DEADLINE
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Referral code = username (lowercase). Append random suffix only on the rare collision.
    let referralCode = generateReferralCode(username);
    const codeConflict = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (codeConflict.length > 0) referralCode = `${generateReferralCode(username)}_${randomBytes(2).toString("hex")}`;

    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), username, passwordHash, plan, trialEndsAt: trialEnd, referralCode })
      .returning();

    // Create empty profile
    await db.insert(userProfilesTable).values({ userId: user.id });

    // Record referral if signup came via a referral link
    const { refCode } = req.body;
    await recordReferral(refCode, user.id);

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id, plan }, "User signed up");
    res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: user.subscriptionEndsAt, isAdmin: user.isAdmin } });
  } catch (err) {
    logger.error(err, "Signup error");
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /auth/google — Google One Tap / OAuth token sign-in
authRouter.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: "Google credential is required" });
      return;
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(503).json({ error: "Google auth not configured" });
      return;
    }

    let payload: { sub: string; email: string; name?: string; picture?: string } | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const p = ticket.getPayload();
      if (!p?.email) throw new Error("No email in token");
      payload = { sub: p.sub, email: p.email, name: p.name, picture: p.picture };
    } catch {
      res.status(401).json({ error: "Invalid Google credential" });
      return;
    }

    const { sub: googleId, email, name } = payload;
    const normalizedEmail = email.toLowerCase();

    // 1. Try find by googleId
    let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, googleId));

    // 2. Try find by email — link Google account to existing user
    if (!user) {
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));
      if (byEmail) {
        [user] = await db
          .update(usersTable)
          .set({ googleId, updatedAt: new Date() })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
        logger.info({ userId: user.id }, "Linked Google account to existing user");
      }
    }

    // 3. Create new user from Google
    if (!user) {
      const HACKATHON_DEADLINE = new Date("2026-08-07T20:00:00Z");
      const now = new Date();
      const trialEnd = now < HACKATHON_DEADLINE ? HACKATHON_DEADLINE : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Generate unique username from email prefix
      const baseUsername = normalizedEmail.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
      let username = baseUsername;
      let suffix = 1;
      while (true) {
        const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username));
        if (!taken) break;
        username = `${baseUsername}${suffix++}`;
      }

      let googleReferralCode = generateReferralCode(username);
      const gcConflict = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, googleReferralCode));
      if (gcConflict.length > 0) googleReferralCode = `${generateReferralCode(username)}_${randomBytes(2).toString("hex")}`;

      [user] = await db
        .insert(usersTable)
        .values({ email: normalizedEmail, username, passwordHash: null, googleId, plan: "trial", trialEndsAt: trialEnd, referralCode: googleReferralCode })
        .returning();
      await db.insert(userProfilesTable).values({ userId: user.id, fullName: name ?? null });

      const { refCode: googleRefCode } = req.body;
      await recordReferral(googleRefCode, user.id);

      logger.info({ userId: user.id }, "New user created via Google");
    }

    const token = signToken({ userId: user.id, email: user.email, username: user.username });
    logger.info({ userId: user.id }, "User signed in via Google");
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, plan: user.plan, trialEndsAt: user.trialEndsAt, subscriptionEndsAt: user.subscriptionEndsAt, isAdmin: user.isAdmin } });
  } catch (err) {
    logger.error(err, "Google auth error");
    res.status(500).json({ error: "Google sign-in failed" });
  }
});

// GET /auth/google-client-id — expose client ID to frontend
authRouter.get("/google-client-id", (_req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
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

    if (!user.passwordHash) {
      res.status(401).json({ error: "This account uses Google sign-in. Please use 'Continue with Google'." });
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
