import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  fullName: text("full_name"),
  creatorName: text("creator_name"),
  mainPlatforms: text("main_platforms"),
  contentFormats: text("content_formats"),
  niche: text("niche"),
  skillLevel: text("skill_level"),
  preferredBountyTypes: text("preferred_bounty_types"),
  minimumReward: real("minimum_reward"),
  weeklyContentCapacity: integer("weekly_content_capacity"),
  targetMonthlyEarnings: real("target_monthly_earnings"),
  creatorStrengths: text("creator_strengths"),
  creatorWeaknesses: text("creator_weaknesses"),
  portfolioLinks: text("portfolio_links"),
  notes: text("notes"),
  roleType: text("role_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;
