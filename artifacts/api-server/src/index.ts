import app from "./app";
import { logger } from "./lib/logger";
import { startCrawlerCron } from "./lib/cron.js";
import { db, referralsTable, campaignEnrollmentsTable, siteUpdatesTable, bountiesTable } from "@workspace/db";
import { sql, eq, isNull, and } from "drizzle-orm";
import { registerWebhook } from "./lib/telegram.js";

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

const SEED_NOTIFICATIONS = [
  {
    title: "New Profile Page + Stars Dashboard + Layout Updates",
    body: "BountyPilot just got a major update: the Stars page is now its own dedicated page with stars balance, daily check-in streaks, and milestone badges. Your profile has been redesigned with a clean view mode and inline editing. The hamburger menu now sits on the left and shows a Close button when open. Enjoy!",
    category: "update",
    pinned: true,
  },
  {
    title: "New Stars Page, Profile Redesign, and More!",
    body: "BountyPilot just got a major update: the Stars page is now its own dedicated page with stars, daily check-ins, and achievements. Profile page has been redesigned with a clean view + inline edit mode. Navigation improvements across the board.",
    category: "feature",
    pinned: true,
  },
  {
    title: "Launchpad Campaign Hub — 4 Campaigns Now Live!",
    body: "The Launchpad has been completely redesigned into a campaign hub with 4 individual campaigns: $50 Crypto (paid referrals), 2 Months Free (all referrals), Yearly Challenge ($200 pool), and Lifetime Challenge ($500 pool). Each campaign has its own leaderboard and progress tracking.",
    category: "feature",
    pinned: true,
  },
  {
    title: "Profile & Stars Update",
    body: "Your profile page got a fresh redesign — tap the pencil icon to edit inline without leaving the page. Stars now live on their own dedicated page accessible from the sidebar.",
    category: "update",
    pinned: false,
  },
  {
    title: "Stars, Profile & Nav Update",
    body: "BountyPilot just got a fresh update:\n\n⭐ Stars page is now its own dedicated space — earn, track, and redeem stars from the sidebar. Check in daily and unlock milestone badges.\n\n👤 Profile has a new clean view + inline edit mode. Tap the pencil icon to edit without leaving the page. The person icon in the header takes you straight to your profile.\n\n☰ The menu button is on the left where it feels natural. Tap it to open the nav drawer — tap Close or anywhere outside to dismiss.\n\n🔔 Notifications now open a detail view when you tap them — see the full message before going anywhere.\n\nMore updates coming soon.",
    category: "update",
    pinned: false,
  },
  {
    title: "Profile Update: Languages & AI Tools",
    body: "Your profile just got smarter!\n\n👨‍💻 Developer? You can now select your Languages & Frameworks (Solidity, Rust, TypeScript, Go, Cairo, Move, and more) directly on your profile.\n\n🤖 VibeCoder? Pick the AI Tools you use — Cursor, Windsurf, Bolt.new, Lovable, v0, Replit, Claude, ChatGPT, and more.\n\nHead to your Profile, tap Edit, and fill in your stack so the AI can match you to the right bounties.",
    category: "feature",
    pinned: true,
  },
];

async function seedNotifications() {
  try {
    for (const notif of SEED_NOTIFICATIONS) {
      const existing = await db
        .select({ id: siteUpdatesTable.id })
        .from(siteUpdatesTable)
        .where(eq(siteUpdatesTable.title, notif.title))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(siteUpdatesTable).values({
          title: notif.title,
          body: notif.body,
          category: notif.category,
          pinned: notif.pinned,
        });
        logger.info({ title: notif.title }, "Seeded notification");
      }
    }
  } catch (err) {
    logger.warn({ err }, "Notification seed failed (non-fatal)");
  }
}

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

async function seedSpotlightBounties() {
  const DEGX_URL = "https://x.com/teddi_speaks/status/2068000633517428897";
  try {
    const existing = await db
      .select({ id: bountiesTable.id })
      .from(bountiesTable)
      .where(and(isNull(bountiesTable.userId), eq(bountiesTable.url, DEGX_URL)))
      .limit(1);
    if (existing.length > 0) return; // already present
    await db.insert(bountiesTable).values({
      title: "$DEGX Content Contest — $500 USDC",
      platform: "X",
      projectName: "Degxifi",
      rewardAmount: "500",
      rewardCurrency: "USDC",
      url: DEGX_URL,
      opportunityType: "Contest",
      opportunityScore: 82,
      scoreExplanation: "A $500 USDC prize pool split across 10 winners for $DEGX content — memes, threads, videos, graphics, or market analysis. Clear judging criteria (creativity, quality, engagement) and a structured multi-step submission process make this a well-defined, accessible opportunity for Web3 content creators.",
      contentFormat: "Memes, Threads, Videos, Graphics, Market Analysis",
      trackCategory: "Content",
      skillsRequired: "Content Creation, Social Media, Crypto Knowledge",
      tags: "x-contest,content,crypto,degx,meme",
      submissionRequirements: "Follow @Degxifi, like & repost the contest post, tag @Degxifi in your post, use the ticker $DEGX",
      deliverables: "Original content about $DEGX — memes, threads, videos, graphics, or market analysis",
      confidenceScore: 95,
      userId: null,
      status: "discovered",
    });
    logger.info("Seeded DEGX spotlight bounty");
  } catch (err) {
    logger.warn({ err }, "Spotlight seed failed (non-fatal)");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedNotifications();
  await backfillCampaignEnrollments();
  await seedSpotlightBounties();
  startCrawlerCron();
  // Register Telegram webhook (production URL)
  registerWebhook("https://bountypilot.xyz/api/telegram/webhook").catch(() => {});
});
