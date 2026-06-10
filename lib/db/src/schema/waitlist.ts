import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const waitlistTable = pgTable("waitlist_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  why: text("why"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WaitlistSignup = typeof waitlistTable.$inferSelect;
