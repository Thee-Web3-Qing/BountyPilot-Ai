import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/use-page-meta";
import {
  Copy, Check, Share2, Link2, DollarSign, Clock, TrendingUp,
  ArrowDownCircle, Users, BarChart3, Trophy, Zap, Gift,
  AlertCircle, ExternalLink, ChevronRight, Megaphone, Wallet,
  SendHorizonal, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────
function getPlanLabel(plan: string) {
  if (plan === "lifetime") return "Lifetime ($250)";
  if (plan === "yearly") return "Yearly ($45)";
  if (plan === "monthly" || plan === "active") return "Monthly ($5)";
  return plan;
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <Card className={`bg-card border-border ${accent ? "border-primary/40" : ""}`}>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        </div>
        <p className={`font-mono text-xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
        {sub && <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="font-mono text-[10px] font-bold text-primary">{n}</span>
      </div>
      <p className="font-mono text-sm text-foreground/80 pt-0.5">{text}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

interface ReferredUser {
  id: number;
  referredUserId: number;
  referredUsername: string;
  referredUserPlan: string;
  tier?: string | null;
  isPaid: boolean;
  createdAt: string;
}

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  walletAddress: string | null;
  totalReferrals: number;
  paidReferrals: number;
  yearlyReferrals: number;
  lifetimeReferrals: number;
  freeReferrals: number;
  referrals: ReferredUser[];
}

interface PayoutRow {
  id: number;
  walletAddress: string;
  amount: number;
  currency: string;
  network: string;
  status: string;
  txHash: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface Commission {
  id: number;
  referredUserId: number;
  referredUsername: string;
  plan: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface CommissionData {
  commissions: Commission[];
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  totalWithdrawn: number;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalReferrals: number;
  paidReferrals: number;
  isWinner: boolean;
  qualifies: boolean;
}

export function Referral() {
  usePageMeta({ title: "Refer & Earn", description: "Your BountyPilot affiliate & referral earnings hub", canonical: "/referral" });
  const { user, token } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null);
  const [lb, setLb] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState(false);
  const [payoutCurrency, setPayoutCurrency] = useState("USDC");
  const [payoutNetwork, setPayoutNetwork] = useState("ethereum");

  const referralLink = user
    ? `${window.location.origin}/signup?ref=${encodeURIComponent(user.username)}`
    : null;
  const referralCode = user?.username ?? null;

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/referrals/my", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/referrals/leaderboard").then(r => r.json()),
      fetch("/api/referrals/commissions", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/referrals/payouts", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ payouts: [] })),
    ]).then(([myStats, lbData, comData, payoutsData]) => {
      if (myStats && !myStats.error) setStats(myStats);
      if (lbData?.paidLeaderboard) setLb(lbData.paidLeaderboard);
      if (comData && !comData.error) setCommissionData(comData);
      if (payoutsData?.payouts) setPayouts(payoutsData.payouts);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const copyLink = () => {
    const link = referralLink ?? stats?.referralLink;
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const link = referralLink ?? stats?.referralLink;
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "Join BountyPilot AI", url: link }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const requestPayout = async () => {
    if (!token) return;
    setRequestingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(false);
    try {
      const res = await fetch("/api/referrals/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currency: payoutCurrency, network: payoutNetwork }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayoutError(data.error ?? "Payout request failed.");
        return;
      }
      setPayoutSuccess(true);
      setPayouts(prev => [data.payout, ...prev]);
      // Refresh commission data to reflect "processing" status
      const comRes = await fetch("/api/referrals/commissions", { headers: { Authorization: `Bearer ${token}` } });
      const comData = await comRes.json();
      if (comData && !comData.error) setCommissionData(comData);
    } finally {
      setRequestingPayout(false);
    }
  };

  // ── Derived numbers ──────────────────────────────────────────
  const commissions = commissionData?.commissions ?? [];
  const freeRefs = (stats?.referrals ?? []).filter(r => !r.isPaid);

  const walletAddress = stats?.walletAddress ?? null;
  const availableBalance = commissionData?.availableBalance ?? 0;
  const pendingEarnings = commissionData?.pendingBalance ?? 0;
  const lifetimeEarnings = commissionData?.lifetimeEarnings ?? 0;
  const totalWithdrawn = commissionData?.totalWithdrawn ?? 0;

  const totalReferrals = stats?.totalReferrals ?? 0;
  const paidCount = stats?.paidReferrals ?? 0;
  const freeCount = stats?.freeReferrals ?? 0;
  const yearlyCount = stats?.yearlyReferrals ?? 0;
  const lifetimeCount = stats?.lifetimeReferrals ?? 0;
  const conversionRate = totalReferrals > 0 ? Math.round((paidCount / totalReferrals) * 100) : 0;
  const revenueGenerated = (paidCount * 5) + (yearlyCount * 45) + (lifetimeCount * 250);

  const hasPendingPayout = payouts.some(p => p.status === "requested" || p.status === "processing");
  const canWithdraw = availableBalance >= 5 && !!walletAddress && !hasPendingPayout;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground font-mono text-sm animate-pulse">
        Loading affiliate dashboard...
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="font-bold font-sans text-2xl uppercase tracking-tighter flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" /> Refer &amp; Earn
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1 max-w-xl">
          Share BountyPilot, help creators discover opportunities, and earn affiliate commissions when people subscribe through your referral link.
        </p>
      </div>

      {/* ── 1: Referral Link ───────────────────────────────── */}
      <Card className="bg-card border-primary/30">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <SectionHead label="Your Referral Link" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 font-mono text-sm bg-background border border-border rounded-sm px-3 py-2 truncate text-muted-foreground min-w-0">
              {referralLink ?? stats?.referralLink ?? "—"}
            </div>
            <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0 font-mono gap-1.5 text-xs uppercase tracking-wider">
              {copied ? <><Check className="w-3.5 h-3.5 text-primary" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </Button>
            <Button onClick={shareLink} variant="outline" size="sm" className="shrink-0 font-mono gap-1.5 text-xs uppercase tracking-wider">
              <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-xs text-muted-foreground">
              Code: <span className="text-primary font-bold tracking-widest">{referralCode ?? stats?.referralCode ?? "—"}</span>
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-sm p-3">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Your referral link automatically tracks <span className="text-foreground">free signups</span>, <span className="text-foreground">paid subscribers</span>, <span className="text-foreground">affiliate commissions</span>, <span className="text-foreground">Stars rewards</span>, and <span className="text-foreground">Launchpad campaign entries</span> — all from a single link.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 2: Launch Pricing Banner ───────────────────────── */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-sm p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" />
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Launch Pricing Ends August 7</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Monthly", price: "$5", after: "$5" },
            { label: "Yearly", price: "$45", after: "$50 after Aug 7" },
            { label: "Lifetime", price: "$250", after: "$300 after Aug 7" },
          ].map(p => (
            <div key={p.label} className="bg-background/60 border border-border rounded-sm p-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</p>
              <p className="font-mono text-lg font-bold text-primary">{p.price}</p>
              <p className="font-mono text-[9px] text-muted-foreground">{p.after}</p>
            </div>
          ))}
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Users who subscribe before August 7 lock in launch pricing. Share your link now to maximize commissions.
        </p>
      </div>

      {/* ── 3: Affiliate Rewards ───────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <SectionHead label="Affiliate Rewards" />
          <p className="font-mono text-xs text-muted-foreground">
            Earn commissions whenever people subscribe through your referral link.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                plan: "Monthly Plan ($5)",
                earn: "$1 / month",
                detail: "Paid for up to 6 months while the referred user stays subscribed. Commission stops if they cancel.",
              },
              {
                plan: "Yearly Plan ($45 launch)",
                earn: "$9 commission",
                detail: "One-time commission per yearly subscriber. Becomes $10 after August 7.",
              },
              {
                plan: "Lifetime Plan ($250 launch)",
                earn: "$50 commission",
                detail: "One-time commission per lifetime subscriber. Becomes $60 after August 7.",
              },
            ].map(row => (
              <div key={row.plan} className="flex items-start gap-3 px-3 py-3 rounded-sm border border-border bg-background">
                <DollarSign className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">{row.plan}</p>
                    <span className="font-mono text-xs font-bold text-primary">{row.earn}</span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{row.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-primary/8 border border-primary/25 rounded-sm p-3 flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="font-mono text-xs text-foreground/90 leading-relaxed">
              Your referral link earns you <span className="text-primary font-bold">affiliate commissions</span>, <span className="text-primary font-bold">Stars rewards</span>, and <span className="text-primary font-bold">Launchpad campaign rewards</span> simultaneously.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── 4: Earnings Overview ───────────────────────────── */}
      <div className="flex flex-col gap-3">
        <SectionHead label="Earnings Overview" />
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={DollarSign} label="Available Balance" value={`$${availableBalance.toFixed(2)}`} sub="Approved & ready" accent />
          <StatCard icon={Clock} label="Pending Earnings" value={`$${pendingEarnings.toFixed(2)}`} sub="Awaiting approval" />
          <StatCard icon={TrendingUp} label="Lifetime Earnings" value={`$${lifetimeEarnings.toFixed(2)}`} sub="All-time total" />
          <StatCard icon={ArrowDownCircle} label="Total Withdrawn" value={`$${totalWithdrawn.toFixed(2)}`} sub="Paid out to date" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard icon={Users} label="Total Paying" value={paidCount} />
          <StatCard icon={Users} label="Monthly Refs" value={paidCount - yearlyCount - lifetimeCount < 0 ? 0 : paidCount - yearlyCount - lifetimeCount} />
          <StatCard icon={Users} label="Yearly Refs" value={yearlyCount} />
          <StatCard icon={Users} label="Lifetime Refs" value={lifetimeCount} />
        </div>
      </div>

      {/* ── 5: Commission History ──────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <SectionHead label="Commission History" />
          {commissions.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center gap-2">
              <DollarSign className="w-8 h-8 text-muted-foreground/20" />
              <p className="font-mono text-sm text-muted-foreground">No affiliate earnings yet.</p>
              <p className="font-mono text-xs text-muted-foreground/70 max-w-xs">
                Share your referral link and start earning commissions when your referrals subscribe.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-1">
                {["User", "Plan", "Commission", "Status"].map(h => (
                  <p key={h} className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">{h}</p>
                ))}
              </div>
              {commissions.map(c => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 rounded-sm border border-border bg-background"
                >
                  <span className="font-mono text-xs text-foreground truncate">@{c.referredUsername}</span>
                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{getPlanLabel(c.plan)}</span>
                  <span className="font-mono text-xs font-bold text-primary whitespace-nowrap">+${c.amount.toFixed(2)}</span>
                  <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${
                    c.status === "approved" || c.status === "paid"
                      ? "text-green-400 border-green-500/30 bg-green-500/10"
                      : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
          {freeRefs.length > 0 && (
            <p className="font-mono text-[10px] text-muted-foreground">
              + {freeRefs.length} free referral{freeRefs.length !== 1 ? "s" : ""} (no commission — free plan)
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── 6: Withdraw Earnings ───────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <SectionHead label="Withdraw Earnings" />
          </div>

          {/* Balance summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Available", value: `$${availableBalance.toFixed(2)}`, accent: true },
              { label: "Pending", value: `$${pendingEarnings.toFixed(2)}`, accent: false },
              { label: "Withdrawn", value: `$${totalWithdrawn.toFixed(2)}`, accent: false },
            ].map(s => (
              <div key={s.label} className={`rounded-sm border p-3 ${s.accent ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className={`font-mono text-lg font-bold ${s.accent ? "text-primary" : "text-foreground"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Wallet address */}
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Payout Wallet</p>
            {walletAddress ? (
              <div className="flex items-center gap-2 bg-background border border-border rounded-sm px-3 py-2">
                <Wallet className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-mono text-xs text-foreground truncate flex-1">{walletAddress}</span>
                <span className="font-mono text-[9px] text-green-400 uppercase tracking-wider border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">Linked</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-background border border-amber-500/30 rounded-sm px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono text-xs text-amber-400 flex-1">No wallet linked — connect one on your Profile page to receive payouts.</span>
              </div>
            )}
          </div>

          {/* Network & currency selector */}
          {walletAddress && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Network</p>
                <select
                  value={payoutNetwork}
                  onChange={e => setPayoutNetwork(e.target.value)}
                  className="bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary/60"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="base">Base</option>
                  <option value="solana">Solana</option>
                  <option value="polygon">Polygon</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Currency</p>
                <select
                  value={payoutCurrency}
                  onChange={e => setPayoutCurrency(e.target.value)}
                  className="bg-background border border-border rounded-sm px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary/60"
                >
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="ETH">ETH</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>
            </div>
          )}

          {/* Action */}
          <div className="flex flex-col gap-2">
            {payoutSuccess && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                <p className="font-mono text-xs text-green-400">Payout requested! You'll receive your crypto once it's processed.</p>
              </div>
            )}
            {payoutError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-red-500/30 bg-red-500/10">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="font-mono text-xs text-red-400">{payoutError}</p>
              </div>
            )}
            {hasPendingPayout && !payoutSuccess && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-sm border border-amber-500/30 bg-amber-500/10">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="font-mono text-xs text-amber-400">Payout in progress — you'll receive it shortly.</p>
              </div>
            )}
            <Button
              disabled={!canWithdraw || requestingPayout}
              className="font-mono uppercase tracking-wider w-full gap-2"
              onClick={requestPayout}
            >
              {requestingPayout
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Requesting...</>
                : <><SendHorizonal className="w-4 h-4" /> Request Payout — ${availableBalance.toFixed(2)}</>
              }
            </Button>
            {!walletAddress && (
              <p className="font-mono text-[10px] text-muted-foreground text-center">
                Link a wallet on your <a href="/profile" className="text-primary underline">Profile page</a> to enable payouts.
              </p>
            )}
            {walletAddress && !hasPendingPayout && availableBalance < 5 && (
              <p className="font-mono text-[10px] text-muted-foreground text-center">
                You need at least $5 in approved earnings to withdraw.
              </p>
            )}
          </div>

          <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <p>• Minimum withdrawal is $5 • Paid to your linked wallet address</p>
            <p>• Earnings must be approved before withdrawal • Fraud is ineligible</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 6b: Payout History ─────────────────────────────── */}
      {payouts.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col gap-3">
            <SectionHead label="Payout History" />
            <div className="space-y-2">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm border border-border bg-background">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-foreground">${p.amount.toFixed(2)}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider border border-border text-muted-foreground px-1.5 py-0.5 rounded">
                        {p.currency} · {p.network}
                      </span>
                    </div>
                    {p.txHash ? (
                      <a
                        href={`https://etherscan.io/tx/${p.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-primary flex items-center gap-1 mt-0.5 hover:underline truncate"
                      >
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        {p.txHash.slice(0, 20)}...
                      </a>
                    ) : (
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-1 rounded border shrink-0 ${
                    p.status === "paid" ? "text-green-400 border-green-500/30 bg-green-500/10"
                    : p.status === "failed" ? "text-red-400 border-red-500/30 bg-red-500/10"
                    : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 7: Create Content. Earn More. ─────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <SectionHead label="Create Content. Earn More." />
          </div>
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">
            The easiest way to earn more referrals is by creating content around opportunities. Talk about bounties, grants, hackathons, ambassador programs, your wins — every piece of content can introduce new users to BountyPilot.
          </p>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ideas to share</p>
            <div className="flex flex-wrap gap-1.5">
              {["Bounties", "Grants", "Hackathons", "Ambassador Programs", "Creator Opportunities", "Your Wins", "Interesting Finds"].map(t => (
                <span key={t} className="font-mono text-[10px] px-2 py-0.5 rounded-sm border border-primary/25 bg-primary/5 text-primary">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Post on</p>
            <div className="flex flex-wrap gap-1.5">
              {["X", "TikTok", "YouTube", "LinkedIn", "Threads", "Telegram", "Discord"].map(p => (
                <span key={p} className="font-mono text-[10px] px-2 py-0.5 rounded-sm border border-border text-muted-foreground">
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={copyLink} variant="outline" size="sm" className="font-mono text-xs uppercase tracking-wider gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Referral Link
            </Button>
            <Button onClick={shareLink} size="sm" className="font-mono text-xs uppercase tracking-wider gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Share Referral Link
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 8: Performance Metrics ────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <SectionHead label="Performance Metrics" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Total Referrals", value: totalReferrals },
              { label: "Free Referrals", value: freeCount },
              { label: "Paid Referrals", value: paidCount },
              { label: "Conversion Rate", value: `${conversionRate}%` },
              { label: "Revenue Generated", value: `$${revenueGenerated}` },
              { label: "Affiliate Earnings", value: `$${lifetimeEarnings.toFixed(2)}` },
            ].map(m => (
              <div key={m.label} className="bg-background border border-border rounded-sm p-3">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className="font-mono text-lg font-bold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 9: Top Ambassadors ────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <SectionHead label="Top Ambassadors" />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            Ranked by paying referrals. Keep growing to hold your spot.
          </p>
          {lb.length === 0 ? (
            <p className="font-mono text-sm text-muted-foreground py-4 text-center">No data yet — be the first ambassador!</p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-1">
                {["#", "Username", "Paying Refs", "Revenue"].map(h => (
                  <p key={h} className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">{h}</p>
                ))}
              </div>
              {lb.map(entry => (
                <div
                  key={entry.rank}
                  className={`grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2.5 rounded-sm border ${
                    entry.username === user?.username
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <span className={`font-mono text-sm font-bold w-6 ${entry.rank <= 3 ? "text-primary" : "text-muted-foreground"}`}>
                    {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank-1] : `#${entry.rank}`}
                  </span>
                  <span className="font-mono text-sm truncate">
                    {entry.username}
                    {entry.username === user?.username && <span className="text-primary ml-2 text-[10px]">(you)</span>}
                  </span>
                  <span className="font-mono text-xs text-primary font-semibold">{entry.paidReferrals}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">${entry.paidReferrals * 5}+</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 10: How It Works ──────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-primary" />
            <SectionHead label="How It Works" />
          </div>
          <div className="flex flex-col gap-3">
            <Step n={1} text="Share your referral link with creators, developers, and Web3 enthusiasts." />
            <Step n={2} text="Users sign up through your link — tracked automatically." />
            <Step n={3} text="When they subscribe to any paid plan, you earn an affiliate commission." />
            <Step n={4} text="Approved commissions become available for withdrawal once confirmed." />
            <Step n={5} text="Keep creating content to grow your referrals and earn more commissions over time." />
          </div>
          <div className="pt-1 border-t border-border">
            <a
              href="/launchpad"
              className="font-mono text-xs text-primary flex items-center gap-1.5 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View referral competitions on Launchpad
            </a>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
