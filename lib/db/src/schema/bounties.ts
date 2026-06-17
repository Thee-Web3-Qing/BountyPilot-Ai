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
  prizeRank: text("prize_rank"),
  prizeBreakdown: text("prize_breakdown"),
  deadline: text("deadline"),
  contentFormat: text("content_format"),
  submissionRequirements: text("submission_requirements"),
  deliverables: text("deliverables"),
  submissionLink: text("submission_link"),
  eligibilityRules: text("eligibility_rules"),
  importantNotes: text("important_notes"),
  opportunityScore: integer("opportunity_score"),
  scoreExplanation: text("score_explanation"),
  scoreBreakdown: text("score_breakdown"),
  confidenceScore: integer("confidence_score"),
  opportunityType: text("opportunity_type").default("Bounty"),
  techStack: text("tech_stack"),
  programmingLanguages: text("programming_languages"),
  teamSize: text("team_size"),
  trackCategory: text("track_category"),
  difficulty: text("difficulty"),
  skillsRequired: text("skills_required"),
  estimatedHours: text("estimated_hours"),
  status: text("status").notNull().default("discovered"),
  hoursSaved: integer("hours_saved"),
  tags: text("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBountySchema = createInsertSchema(bountiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBounty = z.infer<typeof insertBountySchema>;
export type Bounty = typeof bountiesTable.$inferSelect;
