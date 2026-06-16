import app from "./app";
import { logger } from "./lib/logger";
import { startCrawlerCron } from "./lib/cron.js";
import { db, referralsTable, campaignEnrollmentsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

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

const CAMPAIGN_SLUGS = ["crypto-50", "free-access", "yearly-challenge", "lifetime-challenge"];

async function backfillCampaignEnrollments() {
  try {
    for (const slug of CAMPAIGN_SLUGS) {
      const result = await db.execute(sql`
        INSERT INTO campaign_enrollments (user_id, campaign_slug, joined_at)
        SELECT DISTINCT referrer_id, ${slug}, NOW()
        FROM referrals
        WHERE NOT EXISTS (
          SELECT 1 FROM campaign_enrollments ce
          WHERE ce.user_id = referrals.referrer_id
            AND ce.campaign_slug = ${slug}
        )
        ON CONFLICT DO NOTHING
      `);
      const count = (result as any).rowCount ?? 0;
      if (count > 0) {
        logger.info({ slug, count }, "Backfilled campaign enrollments");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Campaign enrollment backfill failed (non-fatal)");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await backfillCampaignEnrollments();
  startCrawlerCron();
});
