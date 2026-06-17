const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
export const BOT_USERNAME = "Bountypilotaibot";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Telegram] sendMessage failed:", err);
    }
  } catch (e) {
    console.error("[Telegram] sendMessage error:", e);
  }
}

export async function registerWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      console.log("[Telegram] Webhook registered:", webhookUrl);
    } else {
      console.error("[Telegram] Webhook registration failed:", data.description);
    }
  } catch (e) {
    console.error("[Telegram] registerWebhook error:", e);
  }
}

export function isTelegramEnabled(): boolean {
  return !!BOT_TOKEN;
}
