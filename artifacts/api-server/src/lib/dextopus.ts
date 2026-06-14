import { logger } from "./logger.js";

const API_BASE = "https://swap-api.dextopus.com/api";
const API_KEY = process.env.DEXTOPUS_API_KEY || "";

if (!API_KEY) {
  logger.warn("DEXTOPUS_API_KEY not set. Dextopus integration will be disabled.");
}

export interface DextopusDeposit {
  depositId: string;
  userId: string;
  originChainId: number;
  originAsset: string;
  settlementChainId: number;
  settlementAsset: string;
  settlementAddress: string;
  depositAddress: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  settlementAmount?: string;
  refundTo?: string;
}

export interface DextopusDepositRequest {
  userId: string;
  originChainId: number;
  originAsset: string;
  settlementChainId: number;
  settlementAsset: string;
  settlementAddress: string;
  refundTo?: string;
}

export interface DextopusWebhookPayload {
  event: string;
  data: {
    depositId: string;
    userId: string;
    status: string;
    requestId: string;
    settlementAmount?: string;
    [key: string]: unknown;
  };
}

async function dextopusFetch(path: string, options: RequestInit = {}) {
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
    logger.warn({ status: resp.status, path, data }, "Dextopus API error");
    throw new Error((data.message as string) || `Dextopus error ${resp.status}`);
  }
  return data;
}

// ── Generate a static deposit address ─────────────────────────────────────
export async function generateStaticAddress(req: DextopusDepositRequest): Promise<{ depositAddress: string; depositId: string }> {
  const data = await dextopusFetch("/deposit/static/generate", {
    method: "POST",
    body: JSON.stringify(req),
  });
  const inner = (data.data as Record<string, unknown> | undefined) || data;
  return {
    depositAddress: (inner.depositAddress as string) || "",
    depositId: (inner.depositId as string) || "",
  };
}

// ── List static addresses for a user ──────────────────────────────
export async function listStaticAddresses(userId: string): Promise<DextopusDeposit[]> {
  const data = await dextopusFetch(`/deposit/static/addresses?userId=${encodeURIComponent(userId)}`);
  return (data.data || data.addresses || []) as DextopusDeposit[];
}

// ── List deposits for a user ──────────────────────────────────────
export async function listDeposits(userId: string, status?: string): Promise<DextopusDeposit[]> {
  let url = `/deposit/static/deposits?userId=${encodeURIComponent(userId)}`;
  if (status) url += `&status=${status}`;
  const data = await dextopusFetch(url);
  return (data.data || data.deposits || []) as DextopusDeposit[];
}

// ── Get a single deposit by requestId ────────────────────────────
export async function getDepositByRequestId(requestId: string): Promise<DextopusDeposit | null> {
  const data = await dextopusFetch(`/deposit/static/deposits/${encodeURIComponent(requestId)}`);
  return (data.data || data) as DextopusDeposit | null;
}

// ── List supported chains ───────────────────────────────────────
export async function listChains(): Promise<Array<{ chainId: number; name: string; logoUrl?: string }>> {
  const data = await dextopusFetch("/deposit/chains");
  return (data.data || data.chains || []) as Array<{ chainId: number; name: string; logoUrl?: string }>;
}

// ── List tokens for a chain ──────────────────────────────────────
export async function listTokens(chainId: number): Promise<Array<{ address: string; symbol: string; name: string; decimals: number; supportsStaticAddress: boolean }>> {
  const data = await dextopusFetch(`/deposit/tokens?chainId=${chainId}`);
  const inner = (data.data as Record<string, unknown> | undefined) || data;
  return (inner.tokens || inner.data || []) as Array<{ address: string; symbol: string; name: string; decimals: number; supportsStaticAddress: boolean }>;
}

// ── Get destinations for an origin token ─────────────────────────
export async function getDestinations(originChainId: number, originAddress: string): Promise<Array<{ chainId: number; address: string; symbol: string; name: string }>> {
  const data = await dextopusFetch(`/deposit/destinations?originChainId=${originChainId}&originAddress=${encodeURIComponent(originAddress)}`);
  return (data.data || data.destinations || data.tokens || []) as Array<{ chainId: number; address: string; symbol: string; name: string }>;
}

export function isDextopusEnabled(): boolean {
  return !!API_KEY;
}
