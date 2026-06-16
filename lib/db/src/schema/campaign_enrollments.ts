import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const campaignEnrollmentsTable = pgTable("campaign_enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  campaignSlug: text("campaign_slug").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.campaignSlug),
}));

export type CampaignEnrollment = typeof campaignEnrollmentsTable.$inferSelect;
