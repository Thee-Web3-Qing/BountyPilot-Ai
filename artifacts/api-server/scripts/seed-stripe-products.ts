import { getUncachableStripeClient } from "../src/lib/stripeClient";
import { getStripeSync } from "../src/lib/stripeClient";

const PRODUCTS = [
  {
    name: "BountyPilot Monthly",
    description: "Monthly subscription — unlimited AI scoring, research briefs, and production plans.",
    prices: [
      { unit_amount: 500, currency: "usd", recurring: { interval: "month" as const }, nickname: "Monthly" },
    ],
  },
  {
    name: "BountyPilot Yearly",
    description: "Yearly subscription — 2 months free, unlimited AI features.",
    prices: [
      { unit_amount: 4500, currency: "usd", recurring: { interval: "year" as const }, nickname: "Yearly Early-Bird" },
      { unit_amount: 5500, currency: "usd", recurring: { interval: "year" as const }, nickname: "Yearly Launch" },
    ],
  },
  {
    name: "BountyPilot Lifetime",
    description: "One-time payment — lifetime access to all AI features forever.",
    prices: [
      { unit_amount: 25000, currency: "usd", nickname: "Lifetime" },
    ],
  },
];

async function seed() {
  const stripe = await getUncachableStripeClient();
  const sync = await getStripeSync();

  for (const product of PRODUCTS) {
    // Create or update product
    const existing = await stripe.products.list({ limit: 100 });
    let p = existing.data.find((x) => x.name === product.name);
    if (!p) {
      p = await stripe.products.create({
        name: product.name,
        description: product.description,
      });
      console.log(`Created product: ${p.name} (${p.id})`);
    } else {
      console.log(`Found existing product: ${p.name} (${p.id})`);
    }

    // Create prices if they don't exist
    for (const priceDef of product.prices) {
      const priceList = await stripe.prices.list({ product: p.id, limit: 100 });
      const match = priceList.data.find(
        (x) =>
          x.unit_amount === priceDef.unit_amount &&
          x.currency === priceDef.currency &&
          (priceDef.recurring
            ? x.recurring?.interval === priceDef.recurring.interval
            : !x.recurring)
      );
      if (!match) {
        const newPrice = await stripe.prices.create({
          product: p.id,
          unit_amount: priceDef.unit_amount,
          currency: priceDef.currency,
          recurring: priceDef.recurring,
          nickname: priceDef.nickname,
        });
        console.log(`  Created price: ${priceDef.nickname} (${newPrice.id})`);
      } else {
        console.log(`  Found existing price: ${priceDef.nickname} (${match.id})`);
      }
    }
  }

  // Sync everything to the database
  console.log("Syncing to database...");
  await sync.syncBackfill();
  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
