import { db } from "@workspace/db";
import { bountiesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export async function countUserBounties(userId: number): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(bountiesTable)
    .where(eq(bountiesTable.userId, userId));
  return Number(result?.value ?? 0);
}
