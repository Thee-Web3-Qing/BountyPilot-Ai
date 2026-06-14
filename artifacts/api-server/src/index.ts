import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./lib/stripeClient";
import app from "./app";
import { logger } from "./lib/logger";
import { startCrawlerCron } from "./lib/cron.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set, skipping Stripe init");
    return;
  }
  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    const stripeSync = await getStripeSync();
    const webhookBaseUrl = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (webhookBaseUrl) {
      const webhookEndpoint = await stripeSync.findOrCreateManagedWebhook(`https://${webhookBaseUrl}/api/stripe/webhook`);
      logger.info({ webhookUrl: webhookEndpoint?.url || "configured" }, "Stripe webhook configured");
    }
    stripeSync.syncBackfill().catch((err: any) => {
      logger.warn({ err: err.message }, "Stripe sync backfill error");
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, "Stripe init failed (expected before integration connected)");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await initStripe();
  startCrawlerCron();
});
