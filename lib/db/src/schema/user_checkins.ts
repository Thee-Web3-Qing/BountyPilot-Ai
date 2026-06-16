import { pgTable, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userCheckinsTable = pgTable("user_checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  checkinDate: timestamp("checkin_date", { withTimezone: true }).notNull().defaultNow(),
  starsEarned: integer("stars_earned").notNull().default(1),
  streakDay: integer("streak_day").notNull().default(1),
  multiplier: real("multiplier").notNull().default(1),
});

export type UserCheckin = typeof userCheckinsTable.$inferSelect;
