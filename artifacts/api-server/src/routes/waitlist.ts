import { Router } from "express";
import { db } from "@workspace/db";
import { waitlistTable, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export const waitlistRouter = Router();

waitlistRouter.post("/join", async (req, res) => {
  try {
    const { email, name, why } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const [countResult] = await db.select({ value: count() }).from(waitlistTable);
    const total = Number(countResult?.value ?? 0);
    if (total >= 1000) {
      return res.status(400).json({ error: "waitlist_full", message: "The waitlist is currently full. Follow us for updates." });
    }

    const existing = await db.select({ id: waitlistTable.id }).from(waitlistTable).where(eq(waitlistTable.email, email.toLowerCase()));
    if (existing.length > 0) {
      return res.status(409).json({ error: "already_on_waitlist", message: "You're already on the waitlist! We'll be in touch soon." });
    }

    const [entry] = await db.insert(waitlistTable).values({
      email: email.toLowerCase(),
      name: name || null,
      why: why || null,
    }).returning();

    logger.info({ email, position: total + 1 }, "New waitlist signup");
    res.status(201).json({ success: true, position: total + 1, message: "You're on the list!" });
  } catch (err) {
    logger.error(err, "Waitlist join error");
    res.status(500).json({ error: "Failed to join waitlist" });
  }
});

waitlistRouter.get("/stats", async (_req, res) => {
  try {
    const [wl] = await db.select({ value: count() }).from(waitlistTable);
    const [users] = await db.select({ value: count() }).from(usersTable);
    res.json({
      waitlistCount: Number(wl?.value ?? 0),
      waitlistMax: 1000,
      spotsLeft: Math.max(0, 1000 - Number(wl?.value ?? 0)),
    });
  } catch (err) {
    logger.error(err, "Waitlist stats error");
    res.status(500).json({ error: "Failed to get waitlist stats" });
  }
});
