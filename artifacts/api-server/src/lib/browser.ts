import puppeteer, { type Browser } from "puppeteer";
import { logger } from "./logger.js";

let _browser: Browser | null = null;
let _launching = false;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  if (_launching) {
    // Wait for the in-progress launch
    await new Promise<void>((res) => {
      const iv = setInterval(() => {
        if (!_launching) { clearInterval(iv); res(); }
      }, 200);
    });
    if (_browser && _browser.connected) return _browser;
  }

  _launching = true;
  try {
    _browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });
    logger.info("Headless browser launched");
    _browser.on("disconnected", () => { _browser = null; });
  } finally {
    _launching = false;
  }
  return _browser!;
}

export async function fetchWithBrowser(url: string, timeoutMs = 25000): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });
    // Block images/fonts to speed up load
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "font", "media"].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: timeoutMs });
    const html = await page.content();
    return html;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function extractLinksWithBrowser(
  url: string,
  linkPattern: RegExp,
  timeoutMs = 25000
): Promise<string[]> {
  const html = await fetchWithBrowser(url, timeoutMs);
  const domain = new URL(url).origin;
  const seen = new Set<string>();
  const results: string[] = [];

  const matches = html.matchAll(linkPattern);
  for (const m of matches) {
    const href = m[1] || m[0];
    const full = href.startsWith("http") ? href : `${domain}${href}`;
    const clean = full.split("?")[0].replace(/\/$/, "");
    if (!seen.has(clean) && clean.length > domain.length + 5) {
      seen.add(clean);
      results.push(clean);
    }
  }
  return results.slice(0, 10);
}

export async function closeBrowser(): Promise<void> {
  await _browser?.close().catch(() => {});
  _browser = null;
}
