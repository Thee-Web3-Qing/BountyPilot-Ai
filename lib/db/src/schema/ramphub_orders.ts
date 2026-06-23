import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ramphubOrdersTable = pgTable("ramphub_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tier: text("tier").notNull(),
  transactionId: text("transaction_id"),
  requestReference: text("request_reference"),
  selectedProvider: text("selected_provider"),
  ngnAmount: text("ngn_amount"),
  usdtAmount: text("usdt_amount"),
  rate: text("rate"),
  status: text("status").notNull().default("PENDING"),
  providerDetails: jsonb("provider_details"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRamphubOrderSchema = createInsertSchema(ramphubOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRamphubOrder = z.infer<typeof insertRamphubOrderSchema>;
export type RamphubOrder = typeof ramphubOrdersTable.$inferSelect;
