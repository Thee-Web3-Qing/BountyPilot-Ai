import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Rocket, Trophy, Gift, Calendar, Star, ArrowRight, Users, Loader2, Clock,
  Zap, Twitter, Send, CheckCircle, AlertCircle, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Campaign static config
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignMeta {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  prize: string;
  prizeLabel: string;
  icon: React.ReactNode;
  accentClass: string;
  borderClass: string;
  type: "crypto" | "access";
  status: "active";
}

const CAMPAIGNS: CampaignMeta[] = [
  {
    slug: "crypto-50",
    title: "Refer & Win $50 Crypto",
    subtitle: "Monthly paid referrals",
    description: "Refer the most monthly paying users. The top 2 referrers each win $25 in crypto sent directly to their wallet.",
    prize: "$50",
    prizeLabel: "prize pool",
    icon: <Trophy className="w-5 h-5" />,
    accentClass: "text-primary",
    borderClass: "border-primary/40",
    type: "crypto",
    status: "active",
  },
  {
    slug: "free-access",
    title: "Refer & Get 2 Months Free",
    subtitle: "Free signup referrals",
    description: "Refer the most free signups. The top 10 referrers with 10+ signups each win 2 months of free BountyPilot access.",
    prize: "2 Mo Free",
    prizeLabel: "top 10 win",
    icon: <Gift className="w-5 h-5" />,
    accentClass: "text-emerald-500",
    borderClass: "border-emerald-500/30",
    type: "access",
    status: "active",
  },
  {
    slug: "yearly-challenge",
    title: "Yearly Challenge",
    subtitle: "Yearly subscriber referrals",
    description: "Refer the most yearly subscribers. $200 prize pool unlocks progressively as the community grows. Milestones at 5 and 10.",
    prize: "$200",
    prizeLabel: "prize pool",
    icon: <Calendar className="w-5 h-5" />,
    accentClass: "text-yellow-500",
    borderClass: "border-yellow-500/30",
    type: "crypto",
    status: "active",
  },
  {
    slug: "lifetime-challenge",
    title: "Lifetime Challenge",
    subtitle: "Lifetime subscriber referrals",
    description: "Refer the most lifetime members. $500 prize pool unlocks progressively. The biggest campaign on BountyPilot.",
    prize: "$500",
    prizeLabel: "prize pool",
    icon: <Star className="w-5 h-5" />,
    accentClass: "text-purple-500",
    borderClass: "border-purple-500/30",
    type: "crypto",
    status: "active",
  },
];

const CONTENT_TYPES = [
  { value: "meme", label: "Meme" },
  { value: "thread", label: "Thread" },
  { value: "video", label: "Video" },
  { value: "graphic", label: "Graphic" },
  { value: "market_analysis", label: "Market Analysis" },
  { value: "creative_post", label: "Creative Post" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Submit Entry Modal
// ─────────────────────────────────────────────────────────────────────────────

interface SubmitEntryModalProps {
  token: string;
  onClose: () => void;
}

function SubmitEntryModal({ token, onClose }: SubmitEntryModalProps) {
  const [xHandle, setXHandle] = useState("");
  const [xPostUrl, setXPostUrl] = useState("");
  const [contentType, setContentType] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!xHandle.trim() || !xPostUrl.trim()) {
      setError("X handle and post URL are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bounty-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bountyId: 505, xHandle, xPostUrl, contentType: contentType || null, walletAddress: walletAddress || null, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-yellow-500/30 rounded-lg w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Twitter className="w-4 h-4 text-sky-400" />
            <span className="font-bold font-mono text-sm uppercase tracking-wider">Submit $DEGX Entry</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-bold font-mono text-sm uppercase tracking-wider text-emerald-500">Entry Submitted!</p>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Your entry has been recorded. Winners will be announced after June 24. Good luck! 🏆
            </p>
            <Button onClick={onClose} className="font-mono text-xs uppercase tracking-wider w-full mt-2">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Rules reminder */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-3 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-yellow-400 mb-1.5">Before submitting, make sure you:</p>
              {["Followed @Degxifi", "Liked & reposted the contest post", "Tagged @Degxifi in your post", "Used the ticker $DEGX"].map(r => (
                <p key={r} className="font-mono text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="text-yellow-400">✓</span> {r}
                </p>
              ))}
            </div>

            {/* X Handle */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Your X Handle <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">@</span>
                <Input
                  value={xHandle}
                  onChange={e => setXHandle(e.target.value.replace(/^@/, ""))}
                  placeholder="yourhandle"
                  className="pl-7 font-mono text-sm"
                  required
                />
              </div>
            </div>

            {/* Post URL */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                X Post URL <span className="text-red-400">*</span>
              </label>
              <Input
                value={xPostUrl}
                onChange={e => setXPostUrl(e.target.value)}
                placeholder="https://x.com/yourhandle/status/..."
                className="font-mono text-xs"
                required
              />
              <p className="font-mono text-[10px] text-muted-foreground">Paste the direct link to your submission post</p>
            </div>

            {/* Content Type */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Content Type</label>
              <div className="grid grid-cols-3 gap-1.5">
                {CONTENT_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setContentType(ct.value)}
                    className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 rounded border transition-colors ${
                      contentType === ct.value
                        ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                        : "border-border text-muted-foreground hover:border-yellow-500/40"
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet Address */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Wallet Address <span className="text-muted-foreground font-normal">(for prize delivery)</span>
              </label>
              <Input
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="Solana wallet address"
                className="font-mono text-xs"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything else you'd like to add..."
                rows={2}
                className="w-full bg-background border border-input rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <p className="font-mono text-xs">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full font-mono text-xs uppercase tracking-wider gap-2 bg-yellow-500 hover:bg-yellow-400 text-black"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {submitting ? "Submitting..." : "Submit Entry"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Launchpad page
// ─────────────────────────────────────────────────────────────────────────────

export function Launchpad() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const { data: degxSpotlight } = useQuery({
    queryKey: ["spotlight", "degx"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch("/api/discover/spotlight/degx", { headers });
      if (!r.ok) return null;
      return r.json() as Promise<{ id: number }>;
    },
    staleTime: 60_000,
  });

  const degxBountyPath = degxSpotlight ? `/bounties/${degxSpotlight.id}` : null;

  const { data: campaignData, isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch("/api/referrals/campaigns", { headers });
      return r.json() as Promise<{
        campaigns: Array<{ slug: string; enrolledCount: number; isEnrolled: boolean }>;
      }>;
    },
    staleTime: 30_000,
  });

  const enrollMap = new Map(
    (campaignData?.campaigns ?? []).map(c => [c.slug, c])
  );

  return (
    <div className="w-full flex flex-col gap-4">
      {showSubmitModal && token && (
        <SubmitEntryModal token={token} onClose={() => setShowSubmitModal(false)} />
      )}

      {/* Header */}
      <div className="mb-2">
        <h1 className="font-bold font-sans text-2xl uppercase tracking-tighter flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Launchpad
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          BountyPilot campaigns — refer, compete, and win. Each leaderboard is completely isolated.
        </p>
      </div>

      {/* ── Spotlight Bounties ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="font-mono text-xs uppercase tracking-widest text-yellow-400">Spotlight Bounty</span>
        </div>

        <Card className="bg-card border-yellow-500/30 overflow-hidden">
          <div className="h-0.5 w-full bg-yellow-500" />
          <CardContent className="p-5 space-y-3">
            <div
              className="flex items-start justify-between gap-3 cursor-pointer"
              onClick={() => degxBountyPath && navigate(degxBountyPath)}
            >
              <div className="flex items-start gap-2">
                <Twitter className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                      Live
                    </span>
                    <span className="font-mono text-[10px] text-sky-400 border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                      X / Twitter
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                      Content
                    </span>
                  </div>
                  <h3 className="font-bold font-sans text-sm uppercase tracking-tight leading-tight">
                    $DEGX Content Contest
                  </h3>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">by Degxifi · hosted by King.sol</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold font-mono text-xl leading-none text-yellow-400">$500</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">USDC pool</p>
              </div>
            </div>

            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Create content about $DEGX — memes, threads, videos, graphics, or market analysis. 10 winners. Judged on creativity, quality &amp; engagement.
            </p>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Ends Jun 24</span>
                <span className="text-yellow-400 hidden sm:inline">🥇 $200 · 🥈 $100 · 🥉 $75 · ×7 $25</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs uppercase tracking-wider h-7 gap-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  onClick={() => degxBountyPath && navigate(degxBountyPath)}
                  disabled={!degxBountyPath}
                >
                  View <ArrowRight className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  className="font-mono text-xs uppercase tracking-wider h-7 gap-1 bg-yellow-500 hover:bg-yellow-400 text-black"
                  onClick={() => setShowSubmitModal(true)}
                >
                  <Send className="w-3 h-3" />
                  Submit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAMPAIGNS.map(campaign => {
            const info = enrollMap.get(campaign.slug);
            return (
              <Card
                key={campaign.slug}
                className={`bg-card ${campaign.borderClass} hover:shadow-md transition-shadow cursor-pointer overflow-hidden`}
                onClick={() => navigate(`/launchpad/campaign/${campaign.slug}`)}
              >
                <div className={`h-0.5 w-full ${
                  campaign.slug === "crypto-50" ? "bg-primary" :
                  campaign.slug === "free-access" ? "bg-emerald-500" :
                  campaign.slug === "yearly-challenge" ? "bg-yellow-500" :
                  "bg-purple-500"
                }`} />
                <CardContent className="p-5 space-y-3">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`${campaign.accentClass}`}>{campaign.icon}</span>
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                            Active
                          </span>
                          {info?.isEnrolled && (
                            <span className="font-mono text-[10px] text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                              Joined
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold font-sans text-sm uppercase tracking-tight leading-tight">
                          {campaign.title}
                        </h3>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold font-mono text-xl leading-none ${campaign.accentClass}`}>
                        {campaign.prize}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{campaign.prizeLabel}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {campaign.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2.5 font-mono text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{info?.enrolledCount ?? 0} joined</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Ends Aug 7</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs uppercase tracking-wider h-7 gap-1"
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      <div className="bg-card border border-border rounded-sm p-4 mt-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">How campaigns work</p>
        <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
          <p><span className="text-primary">01</span> — Each campaign has its own isolated leaderboard</p>
          <p><span className="text-primary">02</span> — A referral counts toward the campaign that matches the referred user's plan</p>
          <p><span className="text-primary">03</span> — You can join and compete in all campaigns simultaneously</p>
          <p><span className="text-primary">04</span> — Prizes are sent directly to your wallet or applied to your account</p>
        </div>
      </div>
    </div>
  );
}
