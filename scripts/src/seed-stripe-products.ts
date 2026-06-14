import { getUncachableStripeClient } from "./stripeClient";

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const plans = [
    {
      name: "BountyPilot Monthly",
      description: "Monthly subscription to BountyPilot AI — full bounty discovery and AI tools.",
      metadata: { tier: "monthly", display_price: "$5" },
      prices: [{ unit_amount: 500, currency: "usd", recurring: { interval: "month" as const } }],
    },
    {
      name: "BountyPilot Yearly",
      description: "Yearly subscription to BountyPilot AI — save $15 vs monthly.",
      metadata: { tier: "yearly", display_price: "$45" },
      prices: [{ unit_amount: 4500, currency: "usd", recurring: { interval: "year" as const } }],
    },
    {
      name: "BountyPilot Lifetime",
      description: "One-time lifetime access to BountyPilot AI — all future updates included.",
      metadata: { tier: "lifetime", display_price: "$250" },
      prices: [{ unit_amount: 25000, currency: "usd" }],
    },
  ];

  for (const plan of plans) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`Skipping ${plan.name} — already exists (${existing.data[0].id})`);
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: plan.metadata,
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    for (const priceDef of plan.prices) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceDef.unit_amount,
        currency: priceDef.currency,
        ...(priceDef.recurring ? { recurring: priceDef.recurring } : {}),
      });
      console.log(`  Created price: $${(priceDef.unit_amount / 100).toFixed(2)} (${price.id})`);
    }
  }

  console.log("\nDone! Products and prices created in Stripe.");
  console.log("Webhooks will sync them to the database automatically.");
}

seedProducts().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
