import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const researchBriefsTable = pgTable("research_briefs", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull(),
  summary: text("summary"),
  contentAngles: text("content_angles"),
  keyPoints: text("key_points"),
  targetAudience: text("target_audience"),
  competitorAnalysis: text("competitor_analysis"),
  fullContent: text("full_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResearchBriefSchema = createInsertSchema(researchBriefsTable).omit({ id: true, createdAt: true });
export type InsertResearchBrief = z.infer<typeof insertResearchBriefSchema>;
export type ResearchBrief = typeof researchBriefsTable.$inferSelect;
