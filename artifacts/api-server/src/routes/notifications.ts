import { Router } from "express";
import { db } from "@workspace/db";
import { siteUpdatesTable, userNotificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { sendTelegramMessage } from "../lib/telegram.js";

export const notificationsRouter = Router();

// GET /public/updates — list all updates for anyone (no auth required)
notificationsRouter.get("/public/updates", async (_req, res) => {
  try {
    const updates = await db
      .select()
      .from(siteUpdatesTable)
      .orderBy(desc(siteUpdatesTable.createdAt));
    res.json({ updates });
  } catch (err) {
    logger.error(err, "Error fetching public updates");
    res.status(500).json({ error: "Failed to fetch updates" });
  }
});

// GET /notifications — list all updates for the user with read status
notificationsRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get all updates, joined with read status for this user
    const updates = await db
      .select({
        id: siteUpdatesTable.id,
        title: siteUpdatesTable.title,
        body: siteUpdatesTable.body,
        category: siteUpdatesTable.category,
        pinned: siteUpdatesTable.pinned,
        createdAt: siteUpdatesTable.createdAt,
        read: userNotificationsTable.read,
        readAt: userNotificationsTable.readAt,
      })
      .from(siteUpdatesTable)
      .leftJoin(
        userNotificationsTable,
        and(
          eq(userNotificationsTable.updateId, siteUpdatesTable.id),
          eq(userNotificationsTable.userId, userId)
        )
      )
      .orderBy(desc(siteUpdatesTable.createdAt));

    // Count unread
    const unread = updates.filter((u) => !u.read).length;

    res.json({ updates, unread });
  } catch (err) {
    logger.error(err, "Error fetching notifications");
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// POST /notifications/:id/read — mark an update as read
notificationsRouter.post("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const updateId = Number(req.params.id);
    if (Number.isNaN(updateId)) {
      res.status(400).json({ error: "Invalid update ID" });
      return;
    }

    // Upsert: insert if not exists, update read=true
    const existing = await db
      .select()
      .from(userNotificationsTable)
      .where(
        and(
          eq(userNotificationsTable.userId, userId),
          eq(userNotificationsTable.updateId, updateId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userNotificationsTable)
        .set({ read: true, readAt: new Date() })
        .where(eq(userNotificationsTable.id, existing[0].id));
    } else {
      await db.insert(userNotificationsTable).values({
        userId,
        updateId,
        read: true,
        readAt: new Date(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Error marking notification read");
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// POST /notifications/read-all — mark all as read
notificationsRouter.post("/read-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get all unread update IDs
    const unread = await db
      .select({ id: siteUpdatesTable.id })
      .from(siteUpdatesTable)
      .leftJoin(
        userNotificationsTable,
        and(
          eq(userNotificationsTable.updateId, siteUpdatesTable.id),
          eq(userNotificationsTable.userId, userId)
        )
      )
      .where(isNull(userNotificationsTable.id));

    const now = new Date();
    for (const u of unread) {
      await db.insert(userNotificationsTable).values({
        userId,
        updateId: u.id,
        read: true,
        readAt: now,
      });
    }

    // Also mark any existing unread as read
    await db
      .update(userNotificationsTable)
      .set({ read: true, readAt: now })
      .where(
        and(
          eq(userNotificationsTable.userId, userId),
          eq(userNotificationsTable.read, false)
        )
      );

    res.json({ ok: true, marked: unread.length });
  } catch (err) {
    logger.error(err, "Error marking all read");
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// POST /notifications/updates — admin creates a new site update
notificationsRouter.post("/updates", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, body, category = "update", pinned = false } = req.body;
    if (!title || !body) {
      res.status(400).json({ error: "Title and body are required" });
      return;
    }

    const [inserted] = await db
      .insert(siteUpdatesTable)
      .values({ title, body, category, pinned })
      .returning();

    // Auto-create notification records for all users (so they show up as unread)
    const allUsers = await db
      .select({ id: usersTable.id, telegramChatId: usersTable.telegramChatId })
      .from(usersTable);

    if (allUsers.length > 0) {
      await db.insert(userNotificationsTable).values(
        allUsers.map((u) => ({
          userId: u.id,
          updateId: inserted.id,
          read: false,
        }))
      );
    }

    // Fan-out Telegram alerts to connected users (fire-and-forget)
    const telegramUsers = allUsers.filter((u) => u.telegramChatId);
    if (telegramUsers.length > 0) {
      const emoji = category === "feature" ? "✨" : category === "alert" ? "⚠️" : "🔔";
      const msg = `${emoji} <b>${title}</b>\n\n${body}\n\n<i>— BountyPilot AI</i>`;
      for (const u of telegramUsers) {
        sendTelegramMessage(u.telegramChatId!, msg).catch(() => {});
      }
    }

    res.json({ ok: true, update: inserted });
  } catch (err) {
    logger.error(err, "Error creating site update");
    res.status(500).json({ error: "Failed to create update" });
  }
});

// DELETE /notifications/updates/:id — admin deletes a site update
notificationsRouter.delete("/updates/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    await db.delete(userNotificationsTable).where(eq(userNotificationsTable.updateId, id));
    await db.delete(siteUpdatesTable).where(eq(siteUpdatesTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Error deleting site update");
    res.status(500).json({ error: "Failed to delete update" });
  }
});
