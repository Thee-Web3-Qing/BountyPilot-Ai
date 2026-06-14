import { getStripeSync, getUncachableStripeClient, getStripeCredentials } from "./stripeClient";
import { handleStripeWebhook } from "./stripeWebhook";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }
    const stripe = await getUncachableStripeClient();
    const { webhookSecret } = await getStripeCredentials();
    if (!webhookSecret) {
      throw new Error("STRIPE WEBHOOK ERROR: Missing webhook secret. Check Stripe integration.");
    }
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    const sync = await getStripeSync();
    await sync.processEvent(event);
    // Run custom business logic after stripe-replit-sync processes the event
    await handleStripeWebhook(event as unknown as { type: string; data: { object: Record<string, unknown> } });
  }
}
