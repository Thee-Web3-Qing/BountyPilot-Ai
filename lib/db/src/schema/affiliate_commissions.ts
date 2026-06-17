import { pgTable, serial, integer, text, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { referralsTable } from "./referrals";

export const affiliateCommissionsTable = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id),
  referredUserId: integer("referred_user_id").notNull().references(() => usersTable.id),
  referralId: integer("referral_id").notNull().references(() => referralsTable.id),
  plan: text("plan").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("affiliate_commissions_referral_id_unique").on(t.referralId)]);

export type AffiliateCommission = typeof affiliateCommissionsTable.$inferSelect;
