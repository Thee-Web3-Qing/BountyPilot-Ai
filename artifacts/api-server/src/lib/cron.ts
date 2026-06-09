import cron from "node-cron";
import { crawlAll, getCrawlerStatus } from "./crawler.js";
import { logger } from "./logger.js";

let cronTask: cron.ScheduledTask | null = null;

function computeNextRun(): string {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next.toISOString();
}

export function startCrawlerCron(): void {
  if (cronTask) return;

  logger.info("Starting hourly bounty crawler cron");

  // Run at the top of every hour: 0 * * * *
  cronTask = cron.schedule("0 * * * *", async () => {
    logger.info("Hourly crawl triggered");
    try {
      await crawlAll();
    } catch (err) {
      logger.error(err, "Cron crawl failed");
    }
  });

  // Also run 60 seconds after startup (initial seed, non-blocking)
  setTimeout(async () => {
    logger.info("Running initial crawl on startup");
    try {
      await crawlAll();
    } catch (err) {
      logger.error(err, "Initial crawl failed");
    }
  }, 60_000);

  logger.info({ nextRun: computeNextRun() }, "Cron scheduled");
}

export function stopCrawlerCron(): void {
  cronTask?.stop();
  cronTask = null;
}

export { getCrawlerStatus };
