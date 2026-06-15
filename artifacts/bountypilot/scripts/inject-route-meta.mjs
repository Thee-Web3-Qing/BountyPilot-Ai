/**
 * Post-build script: generates per-route HTML files with baked-in head metadata
 * so social/AI crawlers see correct title, description, og:*, and canonical
 * for each public route without requiring a server or SSR.
 *
 * Adds:
 *   dist/public/pricing/index.html  → /pricing metadata
 *
 * The root dist/public/index.html already has landing-page metadata from index.html.
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist/public");
const baseHtml = readFileSync(resolve(distDir, "index.html"), "utf8");

const BASE_URL = "https://bountypilot.xyz";
const OG_IMAGE = `${BASE_URL}/opengraph.jpg`;

const routes = [
  {
    path: "pricing",
    meta: {
      title: "Pricing — BountyPilot AI",
      description:
        "Choose a BountyPilot AI plan and unlock AI-powered bug bounty discovery, scope analysis, and report drafting. Free, Active, and Lifetime tiers available.",
      canonical: `${BASE_URL}/pricing`,
      ogTitle: "BountyPilot AI Pricing — Plans for Every Security Researcher",
      ogDescription:
        "Unlock AI-powered bug bounty tools with BountyPilot AI. Compare Free, Active, and Lifetime plans and start hunting smarter.",
    },
  },
];

function buildHead(meta) {
  return `
    <!-- Primary metadata -->
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}" />
    <meta name="robots" content="index, follow" />

    <!-- Canonical -->
    <link rel="canonical" href="${meta.canonical}" />

    <!-- Open Graph -->
    <meta property="og:site_name" content="BountyPilot AI" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="${meta.canonical}" />
    <meta property="og:title" content="${meta.ogTitle ?? meta.title}" />
    <meta property="og:description" content="${meta.ogDescription ?? meta.description}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:alt" content="BountyPilot AI — bug bounty platform" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter / X -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@bountypilot" />
    <meta name="twitter:title" content="${meta.ogTitle ?? meta.title}" />
    <meta name="twitter:description" content="${meta.ogDescription ?? meta.description}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <meta name="twitter:image:alt" content="BountyPilot AI — bug bounty platform" />`.trim();
}

/**
 * Replace everything between <!-- Primary metadata --> (or <title>) and
 * the first non-metadata tag in the head with per-route content.
 * We locate the sentinel comment we put in index.html.
 */
function injectMeta(html, meta) {
  const startMarker = "<!-- Primary metadata -->";
  const endMarker = "<!-- JSON-LD";

  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find metadata sentinel markers in index.html");
    process.exit(1);
  }

  const newHead = buildHead(meta);
  return html.slice(0, startIdx) + newHead + "\n\n    " + html.slice(endIdx);
}

for (const route of routes) {
  const html = injectMeta(baseHtml, route.meta);
  const outDir = resolve(distDir, route.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "index.html"), html, "utf8");
  console.log(`✓ Generated ${route.path}/index.html`);
}

console.log("Route meta injection complete.");
