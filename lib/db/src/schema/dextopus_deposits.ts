import { pgTable, text, serial, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dextopusDepositsTable = pgTable("dextopus_deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  depositId: text("deposit_id").notNull(),
  requestId: text("request_id"),
  tier: text("tier").notNull(), // monthly, yearly, lifetime
  originChainId: integer("origin_chain_id"),
  originAsset: text("origin_asset"),
  settlementChainId: integer("settlement_chain_id"),
  settlementAsset: text("settlement_asset"),
  settlementAddress: text("settlement_address"),
  depositAddress: text("deposit_address").notNull(),
  expectedAmount: text("expected_amount"), // USD value
  status: text("status").notNull().default("PENDING"),
  settlementAmount: text("settlement_amount"),
  refundTo: text("refund_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDextopusDepositSchema = createInsertSchema(dextopusDepositsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDextopusDeposit = z.infer<typeof insertDextopusDepositSchema>;
export type DextopusDeposit = typeof dextopusDepositsTable.$inferSelect;
