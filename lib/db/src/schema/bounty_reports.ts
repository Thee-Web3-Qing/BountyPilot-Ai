import { pgTable, integer, text, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bountyReportsTable = pgTable("bounty_reports", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull(),
  userId: integer("user_id").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: integer("resolved_by"),
  resolution: text("resolution"),
});

export const insertBountyReportSchema = createInsertSchema(bountyReportsTable).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
  resolution: true,
});

export type InsertBountyReport = z.infer<typeof insertBountyReportSchema>;
export type BountyReport = typeof bountyReportsTable.$inferSelect;
