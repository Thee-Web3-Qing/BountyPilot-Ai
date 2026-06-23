import { logger } from "./logger.js";

const API_BASE = "https://api.ramphub.io/api/developer";
const API_KEY = process.env.RAMPHUB_API_KEY || "";

if (!API_KEY) {
  logger.warn("RAMPHUB_API_KEY not set. RampHub integration will be disabled.");
}

async function ramphubFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resp.ok) {
    logger.warn({ status: resp.status, path, data }, "RampHub API error");
    throw new Error(
      (data.message as string) || (data.error as string) || `RampHub error ${resp.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

export interface RamphubQuoteResult {
  side: string;
  asset: string;
  chain: string;
  bestQuote: {
    provider: string;
    rate: number;
    estimatedOutput: number;
  };
  quotes: unknown[];
}

export interface RamphubOrderResult {
  transactionId: string;
  requestReference: string;
  side: string;
  asset: string;
  chain: string;
  selectedProvider: string;
  bestRateUsed: number;
  providerDetails: Record<string, unknown>;
  ourCryptoAddress: string | null;
  environment: string;
  sandbox: boolean;
  trackable: boolean;
}

export interface RamphubOrderRequest {
  side: "buy" | "sell";
  amount: number;
  fiatAmount: number;
  fiatCurrency: string;
  asset: string;
  chain: string;
  walletAddress?: string;
  email?: string;
  externalCustomerId?: string;
  developerFeePercent?: number;
  overrideActiveIntent?: boolean;
}

export async function getQuote(params: {
  side: "buy" | "sell";
  fiatCurrency: string;
  asset: string;
  chain: string;
  fiatAmount?: number;
  tokenAmount?: number;
}): Promise<RamphubQuoteResult> {
  const data = await ramphubFetch("/quotes", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return data as unknown as RamphubQuoteResult;
}

export async function createOrder(req: RamphubOrderRequest): Promise<RamphubOrderResult> {
  const data = await ramphubFetch("/orders", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return data as unknown as RamphubOrderResult;
}

export async function monitorStatus(transactionId: string): Promise<Record<string, unknown>> {
  const data = await ramphubFetch(`/orders/${encodeURIComponent(transactionId)}/monitor-status`, {
    method: "POST",
  });
  return data;
}

export function isRamphubEnabled(): boolean {
  return !!API_KEY;
}
