import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { stripeStorage } from "./stripeStorage";
import { logger } from "./logger";

export async function handleStripeWebhook(event: {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}): Promise<void> {
  const { type, data } = event;
  const object = data.object;

  if (type === "checkout.session.completed") {
    const customerId = object.customer as string;
    const mode = object.mode as string;
    const status = object.status as string;
    if (status !== "complete") return;

    const customer = await stripeStorage.getCustomerById(customerId);
    const userId = customer?.metadata?.userId as string | undefined;
    if (!userId) {
      logger.warn({ customerId }, "No userId found on customer for checkout session");
      return;
    }
    const id = Number(userId);
    if (Number.isNaN(id)) {
      logger.warn({ userId }, "Invalid userId on customer metadata");
      return;
    }

    const plan = mode === "payment" ? "lifetime" : "active";
    await db
      .update(usersTable)
      .set({ plan, updatedAt: new Date() })
      .where(eq(usersTable.id, id));
    logger.info({ userId: id, plan, mode }, "User plan updated after checkout");
  }

  if (type === "invoice.payment_succeeded" || type === "invoice.paid") {
    const customerId = object.customer as string;
    const customer = await stripeStorage.getCustomerById(customerId);
    const userId = customer?.metadata?.userId as string | undefined;
    if (!userId) return;
    const id = Number(userId);
    if (Number.isNaN(id)) return;
    await db
      .update(usersTable)
      .set({ plan: "active", updatedAt: new Date() })
      .where(eq(usersTable.id, id));
    logger.info({ userId: id }, "User plan set to active on payment succeeded");
  }

  if (type === "customer.subscription.deleted" || type === "invoice.payment_failed") {
    const customerId = (object.customer as string) || object.customer_id as string;
    const customer = await stripeStorage.getCustomerById(customerId);
    const userId = customer?.metadata?.userId as string | undefined;
    if (!userId) return;
    const id = Number(userId);
    if (Number.isNaN(id)) return;
    await db
      .update(usersTable)
      .set({ plan: "expired", updatedAt: new Date() })
      .where(eq(usersTable.id, id));
    logger.info({ userId: id }, "User plan set to expired on subscription cancellation/payment failure");
  }
}
