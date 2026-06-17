import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { sendTelegramMessage, BOT_USERNAME, isTelegramEnabled } from "../lib/telegram.js";
import crypto from "crypto";

export const telegramRouter = Router();

// GET /telegram/status — is Telegram connected for this user?
telegramRouter.get("/status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db
      .select({ telegramChatId: usersTable.telegramChatId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    res.json({
      enabled: isTelegramEnabled(),
      connected: !!user?.telegramChatId,
      botUsername: BOT_USERNAME,
    });
  } catch (err) {
    logger.error(err, "Telegram status error");
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

// POST /telegram/connect — generate a one-time token and return the bot deep link
telegramRouter.post("/connect", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!isTelegramEnabled()) {
      res.status(503).json({ error: "Telegram not configured" });
      return;
    }
    const userId = req.user!.userId;
    const token = crypto.randomBytes(20).toString("hex");
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db
      .update(usersTable)
      .set({ telegramConnectToken: token, telegramConnectTokenExpires: expires })
      .where(eq(usersTable.id, userId));

    res.json({
      deepLink: `https://t.me/${BOT_USERNAME}?start=${token}`,
      expiresAt: expires.toISOString(),
    });
  } catch (err) {
    logger.error(err, "Telegram connect error");
    res.status(500).json({ error: "Failed to generate connect link" });
  }
});

// DELETE /telegram/disconnect — unlink Telegram
telegramRouter.delete("/disconnect", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    await db
      .update(usersTable)
      .set({ telegramChatId: null, telegramConnectToken: null, telegramConnectTokenExpires: null })
      .where(eq(usersTable.id, userId));

    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Telegram disconnect error");
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

// POST /telegram/webhook — receives updates from Telegram
telegramRouter.post("/webhook", async (req, res) => {
  try {
    const update = req.body as TelegramUpdate;

    const message = update.message;
    if (!message?.text?.startsWith("/start")) {
      res.json({ ok: true });
      return;
    }

    const token = message.text.replace("/start", "").trim();
    const chatId = String(message.chat.id);
    const firstName = message.from?.first_name || "there";

    if (!token) {
      await sendTelegramMessage(chatId,
        "👋 Welcome to <b>BountyPilot AI</b>!\n\nTo connect your account, open the app and go to <b>Settings → Connect Telegram</b>.");
      res.json({ ok: true });
      return;
    }

    // Find the user with this token (not expired)
    const now = new Date();
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, telegramConnectTokenExpires: usersTable.telegramConnectTokenExpires })
      .from(usersTable)
      .where(eq(usersTable.telegramConnectToken, token));

    if (!user) {
      await sendTelegramMessage(chatId, "⚠️ This link is invalid or has already been used. Please generate a new one from the BountyPilot app.");
      res.json({ ok: true });
      return;
    }

    if (user.telegramConnectTokenExpires && user.telegramConnectTokenExpires < now) {
      await sendTelegramMessage(chatId, "⏰ This link has expired. Please generate a new one from the BountyPilot app.");
      res.json({ ok: true });
      return;
    }

    // Link the account
    await db
      .update(usersTable)
      .set({ telegramChatId: chatId, telegramConnectToken: null, telegramConnectTokenExpires: null })
      .where(eq(usersTable.id, user.id));

    await sendTelegramMessage(chatId,
      `✅ <b>Connected!</b>\n\nHey ${firstName} 👋 — your BountyPilot account (<b>${user.username}</b>) is now linked.\n\nYou'll receive alerts for new opportunities and platform updates right here. 🚀`);

    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "Telegram webhook error");
    res.json({ ok: true }); // Always 200 to Telegram
  }
});

// POST /telegram/register-webhook — admin utility to (re)register the webhook URL
telegramRouter.post("/register-webhook", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    const { registerWebhook } = await import("../lib/telegram.js");
    const webhookUrl = `https://bountypilot.xyz/api/telegram/webhook`;
    await registerWebhook(webhookUrl);
    res.json({ ok: true, webhookUrl });
  } catch (err) {
    logger.error(err, "Register webhook error");
    res.status(500).json({ error: "Failed" });
  }
});

interface TelegramUpdate {
  message?: {
    text?: string;
    chat: { id: number };
    from?: { first_name?: string };
  };
}
