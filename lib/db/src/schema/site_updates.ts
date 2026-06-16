import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const siteUpdatesTable = pgTable("site_updates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("update"), // update, feature, fix, announcement
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteUpdate = typeof siteUpdatesTable.$inferSelect;
