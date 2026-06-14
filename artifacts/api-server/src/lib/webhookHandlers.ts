import { getStripeSync } from "./stripeClient";
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
    const sync = await getStripeSync();
    const result = await sync.processWebhook(payload, signature);
    // Run custom business logic after stripe-replit-sync processes the event
    if (result?.event) {
      await handleStripeWebhook(result.event as { type: string; data: { object: Record<string, unknown> } });
    }
  }
}
