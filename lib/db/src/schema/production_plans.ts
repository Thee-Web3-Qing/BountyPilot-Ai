import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productionPlansTable = pgTable("production_plans", {
  id: serial("id").primaryKey(),
  bountyId: integer("bounty_id").notNull(),
  scriptOutline: text("script_outline"),
  shotList: text("shot_list"),
  captionDraft: text("caption_draft"),
  submissionChecklist: text("submission_checklist"),
  estimatedHours: real("estimated_hours"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductionPlanSchema = createInsertSchema(productionPlansTable).omit({ id: true, createdAt: true });
export type InsertProductionPlan = z.infer<typeof insertProductionPlanSchema>;
export type ProductionPlan = typeof productionPlansTable.$inferSelect;
