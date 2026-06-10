import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bountiesTable = pgTable("bounties", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  url: text("url").notNull(),
  title: text("title"),
  platform: text("platform"),
  projectName: text("project_name"),
  rewardAmount: text("reward_amount"),
  rewardCurrency: text("reward_currency"),
  deadline: text("deadline"),
  contentFormat: text("content_format"),
  submissionRequirements: text("submission_requirements"),
  deliverables: text("deliverables"),
  submissionLink: text("submission_link"),
  eligibilityRules: text("eligibility_rules"),
  importantNotes: text("important_notes"),
  opportunityScore: integer("opportunity_score"),
  scoreExplanation: text("score_explanation"),
  confidenceScore: integer("confidence_score"),
  opportunityType: text("opportunity_type").default("Bounty"),
  status: text("status").notNull().default("discovered"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBountySchema = createInsertSchema(bountiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBounty = z.infer<typeof insertBountySchema>;
export type Bounty = typeof bountiesTable.$inferSelect;
