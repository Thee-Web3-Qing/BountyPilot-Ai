import { Router } from "express";
import { stripeService } from "../lib/stripeService";
import { stripeStorage } from "../lib/stripeStorage";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.use(requireAuth);

// Get products with prices
router.get("/products", async (_req: AuthRequest, res) => {
  try {
    const products = await stripeStorage.listProductsWithPrices();
    const grouped = new Map<string, any>();
    for (const row of products) {
      const productId = row.product_id as string;
      if (!grouped.has(productId)) {
        grouped.set(productId, {
          id: productId,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        grouped.get(productId).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
        });
      }
    }
    res.json({ data: Array.from(grouped.values()) });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

// Create checkout session
router.post("/checkout", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId required" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find or create customer
    let customer = await stripeStorage.getCustomerByEmail(user.email);
    let customerId = customer?.id;
    if (!customerId) {
      const newCustomer = await stripeService.createCustomer(user.email, userId);
      customerId = newCustomer.id;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await stripeService.createCheckoutSession(
      customerId as string,
      priceId,
      `${baseUrl}/checkout/success`,
      `${baseUrl}/checkout/cancel`
    );

    res.json({ url: session.url });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

// Get user subscription status
router.get("/subscription", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const subscription = await stripeStorage.getUserSubscription(userId);
    res.json({ subscription });
    return;
  } catch (e: any) {
    res.status(500).json({ error: e.message });
    return;
  }
});

export default router;
