import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { bountiesTable } from "./bounties";

export const bountyEntriesTable = pgTable("bounty_entries", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull().references(() => bountiesTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  xHandle: text("x_handle").notNull(),
  xPostUrl: text("x_post_url").notNull(),
  contentType: text("content_type"),
  walletAddress: text("wallet_address"),
  notes: text("notes"),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BountyEntry = typeof bountyEntriesTable.$inferSelect;
