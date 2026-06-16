import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id),
  referredUserId: integer("referred_user_id").notNull().references(() => usersTable.id),
  referredUserPlan: text("referred_user_plan").notNull().default("trial"),
  tier: text("tier"), // monthly, yearly, lifetime (from dextopus deposit)
  qualifies: boolean("qualifies").notNull().default(false),
  rewardGranted: boolean("reward_granted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
