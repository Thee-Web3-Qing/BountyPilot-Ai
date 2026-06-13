#!/usr/bin/env tsx
/**
 * Database Export Script for Replit -> Supabase Migration
 * Run: npx tsx scripts/export-db.ts > db-export.sql
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function exportAll() {
  console.log("-- BountyPilot Database Export");
  console.log("-- Generated:", new Date().toISOString());
  console.log("-- WARNING: Import into Supabase using pg_dump or psql");
  console.log();

  // Tables in dependency order
  const tables = [
    "users",
    "user_profiles",
    "bounties",
    "bounty_reports",
    "research_briefs",
    "production_plans",
    "submissions",
    "earnings",
  ];

  for (const table of tables) {
    console.log(`-- Table: ${table}`);
    const result = await db.execute(sql.raw(`SELECT * FROM "${table}"`));
    console.log(`-- Rows: ${result.rows.length}`);
    for (const row of result.rows) {
      const keys = Object.keys(row);
      const values = keys.map(k => {
        const v = row[k];
        if (v === null) return "NULL";
        if (typeof v === "string") return "'" + v.replace(/'/g, "''") + "'";
        if (v instanceof Date) return "'" + v.toISOString() + "'";
        return String(v);
      });
      console.log(`INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(", ")}) VALUES (${values.join(", ")});`);
    }
    console.log();
  }

  console.log("-- Export complete!");
}

exportAll().catch(e => {
  console.error("Export failed:", e);
  process.exit(1);
});
