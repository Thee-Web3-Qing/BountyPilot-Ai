import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useState, useEffect } from "react";
import { usePageMeta } from "@/lib/use-page-meta";
import {
  ArrowLeft,
  Check,
  Zap,
  Crown,
  Star,
  Loader2,
  Wallet,
  Bitcoin,
  ExternalLink,
  Copy,
  CheckCircle2,
  Settings2,
  Gift,
  RefreshCw,
  Banknote,
  Building2,
  Hash,
  User,
  DollarSign,
} from "lucide-react";

interface Chain {
  chainId: number;
  name: string;
  logoUrl?: string;
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  supportsStaticAddress: boolean;
}

interface DepositResult {
  depositId: string;
  requestId: string;
  depositAddress: string;
  tier: string;
  expectedAmount: string;
  status: string;
}

const API_BASE = "/api";

const DISPLAY_TIER: Record<string, {
  name: string;
  displayPrice: string;
  originalPrice?: string;
  unit: string;
  badge?: string;
  features: string[];
}> = {
  monthly: {
    name: "Monthly",
    displayPrice: "$5",
    unit: "USD/month",
    features: ["All bounties", "AI scoring", "Research briefs", "Production plans"],
  },
  yearly: {
    name: "Yearly",
    displayPrice: "$45",
    originalPrice: "$55",
    unit: "USD/year",
    badge: "Pre-Launch Deal",
    features: ["All bounties", "AI scoring", "Research briefs", "Production plans", "Save $10"],
  },
  lifetime: {
    name: "Lifetime",
    displayPrice: "$250",
    originalPrice: "$300",
    unit: "USD one-time",
    badge: "Best Value",
    features: [
      "All bounties forever",
      "AI scoring",
      "Research briefs",
      "Production plans",
      "No recurring fees",
      "All future updates",
    ],
  },
};

export function Pricing() {
  const [, navigate] = useLocation();
  const { token, isAuthenticated, user, planStatus } = useAuth();

  usePageMeta({
    title: "Pricing — BountyPilot AI",
    description:
      "Choose a BountyPilot AI plan and unlock AI-powered bug bounty discovery, scope analysis, and report drafting. Free, Active, and Lifetime tiers available.",
    canonical: "https://bountypilot.xyz/pricing",
    ogUrl: "https://bountypilot.xyz/pricing",
    ogTitle: "BountyPilot AI Pricing — Plans for Every Security Researcher",
    ogDescription:
      "Unlock AI-powered bug bounty tools with BountyPilot AI. Compare Free, Active, and Lifetime plans and start hunting smarter.",
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [userActiveTier, setUserActiveTier] = useState<string | null>(null);
  const [dextopusEnabled, setDextopusEnabled] = useState(false);
  const [deposit, setDeposit] = useState<DepositResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Dextopus checkout flow
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const [txSubmitted, setTxSubmitted] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [chainsLoading, setChainsLoading] = useState(false);
  const [tokensLoading, setTokensLoading] = useState(false);

  // RampHub (Naira) checkout flow
  const [ramphubEnabled, setRamphubEnabled] = useState(false);
  const [showNairaCheckout, setShowNairaCheckout] = useState(false);
  const [nairaSelectedTier, setNairaSelectedTier] = useState<string | null>(null);
  const [nairaQuote, setNairaQuote] = useState<{ ngnAmount: number; usdtAmount: number; rate: number; provider: string } | null>(null);
  const [nairaQuoteLoading, setNairaQuoteLoading] = useState(false);
  const [nairaOrder, setNairaOrder] = useState<{ transactionId: string; requestReference: string; providerDetails: Record<string, unknown>; ngnAmount: number; usdtAmount: number; selectedProvider: string } | null>(null);
  const [nairaOrderLoading, setNairaOrderLoading] = useState(false);
  const [nairaSubmitted, setNairaSubmitted] = useState(false);
  const [nairaError, setNairaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dextRes, rhRes] = await Promise.all([
          fetch(`${API_BASE}/dextopus/status`),
          fetch(`${API_BASE}/ramphub/status`),
        ]);
        const dextJson = await dextRes.json();
        const rhJson = await rhRes.json();
        if (!cancelled) {
          setDextopusEnabled(dextJson.enabled);
          setRamphubEnabled(rhJson.enabled);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch active subscription tier for paid users
  useEffect(() => {
    if (!isAuthenticated || !token || planStatus !== "active") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dextopus/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!cancelled && json.subscription?.tier) {
          setUserActiveTier(json.subscription.tier);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token, planStatus]);

  useEffect(() => {
    if (!showCheckout) return;
    setChainsLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dextopus/chains`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!cancelled && json.data) {
          setChains(json.data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setChainsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showCheckout, token]);

  useEffect(() => {
    if (!selectedChain) {
      setTokens([]);
      return;
    }
    setTokensLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dextopus/tokens?chainId=${selectedChain}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!cancelled && json.data) {
          // Only show tokens that support static deposit addresses
          const filtered = (json.data as Token[]).filter(t => t.supportsStaticAddress !== false);
          setTokens(filtered.length > 0 ? filtered : json.data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setTokensLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChain, token]);

  const handleStartCheckout = (tier: string) => {
    if (!token) {
      navigate("/login?redirect=pricing");
      return;
    }
    setSelectedTier(tier);
    setShowCheckout(true);
    setDeposit(null);
    setSelectedChain(null);
    setSelectedToken(null);
    setTxHash("");
    setTxSubmitted(false);
  };

  const handleStartNairaCheckout = async (tier: string) => {
    if (!token) {
      navigate("/login?redirect=pricing");
      return;
    }
    setNairaSelectedTier(tier);
    setNairaOrder(null);
    setNairaQuote(null);
    setNairaSubmitted(false);
    setNairaError(null);
    setShowNairaCheckout(true);
    setNairaQuoteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ramphub/quote?tier=${tier}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Quote failed");
      setNairaQuote({ ngnAmount: json.ngnAmount, usdtAmount: json.usdtAmount, rate: json.rate, provider: json.provider });
    } catch (e: any) {
      setNairaError(e.message || "Could not fetch NGN quote. Try again.");
    } finally {
      setNairaQuoteLoading(false);
    }
  };

  const handleCreateNairaOrder = async () => {
    if (!nairaSelectedTier || !nairaQuote || !token) return;
    setNairaOrderLoading(true);
    setNairaError(null);
    try {
      const res = await fetch(`${API_BASE}/ramphub/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: nairaSelectedTier, ngnAmount: nairaQuote.ngnAmount }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "ACTIVE_INTENT_CONFLICT") {
          const retryRes = await fetch(`${API_BASE}/ramphub/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tier: nairaSelectedTier, ngnAmount: nairaQuote.ngnAmount, overrideActiveIntent: true }),
          });
          const retryJson = await retryRes.json();
          if (!retryRes.ok) throw new Error(retryJson.error || "Order creation failed");
          setNairaOrder(retryJson.data);
        } else {
          throw new Error(json.error || "Order creation failed");
        }
      } else {
        setNairaOrder(json.data);
      }
    } catch (e: any) {
      setNairaError(e.message || "Failed to create order. Please try again.");
    } finally {
      setNairaOrderLoading(false);
    }
  };

  const handleGenerateDeposit = async () => {
    if (!selectedChain || !selectedToken || !selectedTier) return;

    setLoading(selectedTier);
    try {
      const res = await fetch(`${API_BASE}/dextopus/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tier: selectedTier,
          originChainId: selectedChain,
          originAsset: selectedToken,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setDeposit(json.data);
      } else {
        alert(json.error || "Failed to generate deposit address");
      }
    } catch (e) {
      alert("Error generating deposit address. Try again.");
    } finally {
      setLoading(null);
    }
  };

  const copyAddress = () => {
    if (deposit?.depositAddress) {
      navigator.clipboard.writeText(deposit.depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmPayment = async () => {
    if (!deposit || !txHash.trim()) return;
    setTxLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dextopus/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ depositId: deposit.depositId || undefined, depositAddress: deposit.depositAddress, txHash: txHash.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setTxSubmitted(true);
      } else {
        alert(json.error || "Failed to confirm. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setTxLoading(false);
    }
  };

  // Derive trial end display
  const trialEndDate = user?.trialEndsAt
    ? new Date(user.trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // Button props for paid tier cards
  const getPaidButtonProps = (tier: string) => {
    if (planStatus === "active") {
      if (userActiveTier === tier || (tier === "lifetime" && user?.plan === "lifetime")) {
        return { label: "Your Current Plan", disabled: true, variant: "outline" as const, icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> };
      }
      return { label: "Switch to Plan", disabled: false, variant: "outline" as const, icon: <RefreshCw className="w-3.5 h-3.5 mr-1" /> };
    }
    return { label: "Pay with Crypto", disabled: !dextopusEnabled || !!loading, variant: "outline" as const, icon: <Wallet className="w-3.5 h-3.5 mr-1" /> };
  };

  const canPayNaira = (tier: string) => {
    if (!ramphubEnabled) return false;
    if (planStatus === "active" && (userActiveTier === tier || (tier === "lifetime" && user?.plan === "lifetime"))) return false;
    return true;
  };

  const renderNairaCheckout = () => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-400" />
            <h2 className="font-sans font-bold text-lg">Pay with Naira (₦)</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowNairaCheckout(false)}>Close</Button>
        </div>

        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/5 border border-green-500/20 rounded-sm">
          <span className="text-xs font-mono text-green-400 uppercase tracking-wider">
            {DISPLAY_TIER[nairaSelectedTier as keyof typeof DISPLAY_TIER]?.name} Plan
          </span>
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            {DISPLAY_TIER[nairaSelectedTier as keyof typeof DISPLAY_TIER]?.displayPrice} USD
          </span>
        </div>

        {nairaError && (
          <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm mb-4">
            {nairaError}
          </div>
        )}

        {!nairaOrder ? (
          <div className="space-y-4">
            {nairaQuoteLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm font-mono text-muted-foreground">Fetching live NGN rate...</p>
              </div>
            ) : nairaQuote ? (
              <div className="space-y-4">
                <div className="bg-muted/20 rounded-lg p-4 space-y-3 border border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-muted-foreground uppercase">You pay</span>
                    <span className="text-2xl font-bold font-mono text-green-400">
                      ₦{nairaQuote.ngnAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-muted-foreground uppercase">We receive</span>
                    <span className="text-sm font-mono">{nairaQuote.usdtAmount} USDT</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="text-xs font-mono text-muted-foreground uppercase">Rate</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      1 USDT ≈ ₦{nairaQuote.rate?.toLocaleString()}
                    </span>
                  </div>
                  {nairaQuote.provider && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-muted-foreground uppercase">Provider</span>
                      <span className="text-xs font-mono text-muted-foreground">{nairaQuote.provider}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  After clicking "Create Order" you'll receive bank transfer details. Transfer the exact NGN amount shown above.
                </p>
                <Button
                  className="w-full font-mono uppercase tracking-wider"
                  onClick={handleCreateNairaOrder}
                  disabled={nairaOrderLoading}
                >
                  {nairaOrderLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Banknote className="w-4 h-4 mr-2" /> Create Order & Get Bank Details</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-mono text-muted-foreground">Could not load quote.</p>
                <Button variant="outline" className="w-full font-mono" onClick={() => handleStartNairaCheckout(nairaSelectedTier!)}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        ) : nairaSubmitted ? (
          <div className="flex items-center gap-2 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Transfer noted! Your plan will activate once payment is confirmed by the provider (usually within minutes).
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-mono text-sm">Order created! Transfer NGN to activate.</span>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 space-y-3 border border-border">
              <div className="flex justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase">Amount to transfer</span>
                <span className="font-bold font-mono text-green-400">₦{nairaOrder.ngnAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-mono text-muted-foreground uppercase">Provider</span>
                <span className="text-xs font-mono">{nairaOrder.selectedProvider}</span>
              </div>
              {nairaOrder.transactionId && (
                <div className="flex justify-between items-start gap-2 pt-2 border-t border-border/50">
                  <span className="text-xs font-mono text-muted-foreground uppercase shrink-0">Ref</span>
                  <span className="text-xs font-mono text-right break-all">{nairaOrder.requestReference || nairaOrder.transactionId}</span>
                </div>
              )}
            </div>

            {nairaOrder.providerDetails && Object.keys(nairaOrder.providerDetails).length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                <p className="text-xs font-mono text-primary uppercase tracking-wider font-bold">Bank Transfer Details</p>
                {Object.entries(nairaOrder.providerDetails).map(([key, val]) => {
                  if (val === null || val === undefined || typeof val === "object") return null;
                  const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase();
                  return (
                    <div key={key} className="flex justify-between items-start gap-3">
                      <span className="text-xs font-mono text-muted-foreground capitalize shrink-0">{label}</span>
                      <span className="text-xs font-mono text-right break-all">{String(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs font-mono text-muted-foreground border border-border/40 rounded px-3 py-2">
              Use the reference number above when making your transfer. Your plan activates automatically once payment is confirmed.
            </p>

            <Button
              className="w-full font-mono uppercase tracking-wider"
              onClick={() => setNairaSubmitted(true)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> I've Made the Transfer
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderCheckout = () => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans font-bold text-lg">
            Pay {DISPLAY_TIER[selectedTier as keyof typeof DISPLAY_TIER]?.name || "Subscription"}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowCheckout(false)}>
            Close
          </Button>
        </div>

        {!deposit ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="w-4 h-4" />
              <span className="font-mono">Select chain to send from</span>
            </div>

            {chainsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {chains.map((chain) => (
                  <button
                    key={chain.chainId}
                    onClick={() => {
                      setSelectedChain(chain.chainId);
                      setSelectedToken(null);
                    }}
                    className={`flex items-center gap-2 p-2 rounded border text-sm font-mono ${
                      selectedChain === chain.chainId
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {chain.logoUrl ? (
                      <img src={chain.logoUrl} alt="" className="w-4 h-4 rounded-full" />
                    ) : (
                      <Bitcoin className="w-4 h-4" />
                    )}
                    <span className="truncate">{chain.name}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedChain && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Bitcoin className="w-4 h-4" />
                  <span className="font-mono">Select token</span>
                </div>
                {tokensLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {tokens.map((token) => (
                      <button
                        key={token.address}
                        onClick={() => setSelectedToken(token.address)}
                        className={`flex items-center gap-2 p-2 rounded border text-sm font-mono ${
                          selectedToken === token.address
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                        title={token.name}
                      >
                        <span className="truncate">{token.symbol}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full font-mono uppercase tracking-wider"
              disabled={!selectedChain || !selectedToken || !!loading}
              onClick={handleGenerateDeposit}
            >
              {loading === selectedTier ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Generate Deposit Address
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-mono text-sm">Deposit address generated!</span>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase">Deposit Address</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm font-mono bg-background p-2 rounded border border-border break-all">
                    {deposit.depositAddress}
                  </code>
                  <Button variant="ghost" size="sm" onClick={copyAddress} className="shrink-0">
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase">Expected Amount</label>
                <div className="text-lg font-mono font-bold">${deposit.expectedAmount} USDC</div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase">Tier</label>
                <div className="text-sm font-mono">{DISPLAY_TIER[deposit.tier as keyof typeof DISPLAY_TIER]?.name}</div>
              </div>

              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase">Status</label>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-xs font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" /> {deposit.status}
                </div>
              </div>

              <div className="text-xs font-mono text-muted-foreground pt-2 border-t border-border">
                Send the exact amount to this address. It will be auto-bridged to our treasury wallet.
              </div>
            </div>

            {txSubmitted ? (
              <div className="flex items-center gap-2 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Payment confirmed! We'll activate your plan once the transaction is verified.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-muted-foreground uppercase">
                    Transaction Hash
                  </label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full p-2 rounded border border-border bg-background text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <Button
                  className="w-full font-mono uppercase tracking-wider"
                  disabled={!txHash.trim() || txLoading}
                  onClick={handleConfirmPayment}
                >
                  {txLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      I Have Sent It
                    </>
                  )}
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full font-mono text-xs"
              onClick={() => {
                setDeposit(null);
                setSelectedChain(null);
                setSelectedToken(null);
                setTxHash("");
                setTxSubmitted(false);
              }}
            >
              Generate New Address
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="font-mono">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 rounded-full px-3 py-1 mb-6">
          <Star className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary uppercase tracking-wider">Pre-Launch Pricing</span>
        </div>

        <h1 className="text-4xl font-bold font-sans uppercase tracking-tighter text-center mb-2">
          Pick Your Plan
        </h1>
        <p className="text-muted-foreground font-mono text-sm text-center mb-10 max-w-lg">
          Lock in launch pricing before we go live. Pay with any crypto — Dextopus auto-bridges.
        </p>

        {/* Free tier card */}
        <div className="w-full border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-4 bg-card/20 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Gift className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-sans font-bold text-base">Free</h3>
                <span className="text-xs font-mono text-muted-foreground">$0 / forever</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                Browse bounties · No AI scoring · Limited access
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {planStatus === "trial" ? (
              <div className="flex flex-col items-end gap-1">
                <Button
                  disabled
                  className="font-mono text-xs uppercase tracking-wider bg-foreground text-background opacity-100 cursor-not-allowed min-w-[180px]"
                >
                  <Gift className="w-3.5 h-3.5 mr-1.5" /> Free Trial Active
                </Button>
                {trialEndDate && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Trial ends {trialEndDate}
                  </span>
                )}
              </div>
            ) : planStatus === "expired" || (planStatus === null && !isAuthenticated) ? (
              <Button
                disabled={planStatus === "expired"}
                variant="outline"
                className="font-mono text-xs uppercase tracking-wider min-w-[180px]"
                onClick={() => !isAuthenticated && navigate("/signup")}
              >
                {planStatus === "expired" ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Your Current Plan</>
                ) : (
                  "Get Started Free"
                )}
              </Button>
            ) : planStatus === "active" ? (
              <span className="text-xs font-mono text-muted-foreground italic">You're on a paid plan</span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {/* Monthly */}
          <div className="border border-border rounded-lg p-6 flex flex-col gap-4 bg-card/30 hover:bg-card/50 transition-colors">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="font-sans font-bold text-lg">{DISPLAY_TIER.monthly.name}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono">{DISPLAY_TIER.monthly.displayPrice}</span>
              <span className="text-muted-foreground font-mono text-sm">{DISPLAY_TIER.monthly.unit}</span>
            </div>
            <ul className="space-y-2">
              {DISPLAY_TIER.monthly.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-sm">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 mt-auto">
              {(() => { const p = getPaidButtonProps("monthly"); return (
                <Button variant={p.variant} className="font-mono text-xs uppercase tracking-wider"
                  onClick={() => !p.disabled && handleStartCheckout("monthly")}
                  disabled={p.disabled}>
                  {p.icon}{p.label}
                </Button>
              ); })()}
              {canPayNaira("monthly") && (
                <Button variant="outline" className="font-mono text-xs uppercase tracking-wider border-green-500/40 text-green-400 hover:bg-green-500/10"
                  onClick={() => handleStartNairaCheckout("monthly")}>
                  <Banknote className="w-3.5 h-3.5 mr-1" /> Pay with Naira (₦)
                </Button>
              )}
            </div>
          </div>

          {/* Yearly */}
          <div className="border border-primary/40 rounded-lg p-6 flex flex-col gap-4 bg-primary/5 relative">
            <span className="absolute top-3 right-3 text-[10px] font-mono bg-primary text-primary-foreground px-2 py-0.5 rounded uppercase tracking-wider">
              {DISPLAY_TIER.yearly.badge}
            </span>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="font-sans font-bold text-lg">{DISPLAY_TIER.yearly.name}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono">{DISPLAY_TIER.yearly.displayPrice}</span>
              <span className="text-muted-foreground font-mono text-sm">{DISPLAY_TIER.yearly.unit}</span>
              <span className="text-sm font-mono text-red-400 line-through ml-2">{DISPLAY_TIER.yearly.originalPrice}</span>
            </div>
            <ul className="space-y-2">
              {DISPLAY_TIER.yearly.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-sm">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 mt-auto">
              {(() => { const p = getPaidButtonProps("yearly"); return (
                <Button variant={p.variant} className="font-mono text-xs uppercase tracking-wider"
                  onClick={() => !p.disabled && handleStartCheckout("yearly")}
                  disabled={p.disabled}>
                  {p.icon}{p.label}
                </Button>
              ); })()}
              {canPayNaira("yearly") && (
                <Button variant="outline" className="font-mono text-xs uppercase tracking-wider border-green-500/40 text-green-400 hover:bg-green-500/10"
                  onClick={() => handleStartNairaCheckout("yearly")}>
                  <Banknote className="w-3.5 h-3.5 mr-1" /> Pay with Naira (₦)
                </Button>
              )}
            </div>
          </div>

          {/* Lifetime */}
          <div className="border border-yellow-500/30 rounded-lg p-6 flex flex-col gap-4 bg-yellow-500/5 relative">
            <span className="absolute top-3 right-3 text-[10px] font-mono bg-yellow-500 text-black px-2 py-0.5 rounded uppercase tracking-wider">
              {DISPLAY_TIER.lifetime.badge}
            </span>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <h3 className="font-sans font-bold text-lg">{DISPLAY_TIER.lifetime.name}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono">{DISPLAY_TIER.lifetime.displayPrice}</span>
              <span className="text-muted-foreground font-mono text-sm">{DISPLAY_TIER.lifetime.unit}</span>
              <span className="text-sm font-mono text-red-400 line-through ml-2">{DISPLAY_TIER.lifetime.originalPrice}</span>
            </div>
            <ul className="space-y-2">
              {DISPLAY_TIER.lifetime.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-sm">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 mt-auto">
              {(() => { const p = getPaidButtonProps("lifetime"); return (
                <Button variant={p.variant} className="font-mono text-xs uppercase tracking-wider"
                  onClick={() => !p.disabled && handleStartCheckout("lifetime")}
                  disabled={p.disabled}>
                  {p.icon}{p.label}
                </Button>
              ); })()}
              {canPayNaira("lifetime") && (
                <Button variant="outline" className="font-mono text-xs uppercase tracking-wider border-green-500/40 text-green-400 hover:bg-green-500/10"
                  onClick={() => handleStartNairaCheckout("lifetime")}>
                  <Banknote className="w-3.5 h-3.5 mr-1" /> Pay with Naira (₦)
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-muted-foreground font-mono text-xs text-center mt-8">
          {dextopusEnabled && "Pay with any crypto — Dextopus auto-bridges to our treasury."}
          {dextopusEnabled && ramphubEnabled && " · "}
          {ramphubEnabled && "Pay with Naira (₦) via bank transfer — powered by RampHub."}
          {!dextopusEnabled && !ramphubEnabled && "Payment options coming soon."}
        </p>
      </div>

      {showCheckout && renderCheckout()}
      {showNairaCheckout && renderNairaCheckout()}
    </div>
  );
}
