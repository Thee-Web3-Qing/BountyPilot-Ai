import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const customBountiesTable = pgTable("custom_bounties", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  reward: numeric("reward", { precision: 10, scale: 2 }).notNull(),
  rewardToken: text("reward_token").notNull().default("USDC"),
  rewardType: text("reward_type").notNull().default("crypto"),
  category: text("category").notNull().default("content"),
  maxParticipants: integer("max_participants"),
  deadline: timestamp("deadline", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  postedById: integer("posted_by_id").references(() => usersTable.id),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customBountyApplicationsTable = pgTable("custom_bounty_applications", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => customBountiesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("pending"),
  submissionNote: text("submission_note"),
  submissionUrl: text("submission_url"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomBounty = typeof customBountiesTable.$inferSelect;
export type CustomBountyApplication = typeof customBountyApplicationsTable.$inferSelect;
