import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userStarTransactionsTable = pgTable("user_star_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: integer("amount").notNull(), // positive = earned, negative = spent
  reason: text("reason").notNull(), // checkin, bonus, redeemed, cashed
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserStarTransaction = typeof userStarTransactionsTable.$inferSelect;
