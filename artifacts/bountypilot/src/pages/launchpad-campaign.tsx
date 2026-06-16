import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Trophy, Gift, Calendar, Star, Users, Copy, Check,
  Crown, Loader2, Lock, CheckCircle2, Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Campaign static config
// ─────────────────────────────────────────────────────────────────────────────

interface CampaignConfig {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  prize: string;
  prizeLabel: string;
  accentClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ReactNode;
  type: "crypto" | "access";
  howToWin: string[];
  prizeBreakdown: Array<{ label: string; value: string }>;
}

const CAMPAIGN_CONFIG: Record<string, CampaignConfig> = {
  "crypto-50": {
    slug: "crypto-50",
    title: "Refer & Win $50 Crypto",
    subtitle: "Monthly Paid Referral Campaign",
    description: "Refer the most monthly paying users. Top 2 referrers each win $25 in crypto, paid directly to their wallet. Monthly subscribers only — yearly and lifetime referrals belong to their own campaigns.",
    prize: "$50",
    prizeLabel: "Prize Pool",
    accentClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/40",
    icon: <Trophy className="w-5 h-5" />,
    type: "crypto",
    howToWin: [
      "Share your referral link with people likely to pay monthly",
      "Each user who subscribes monthly through your link counts",
      "Yearly and lifetime referrals don't count here — they have their own campaigns",
      "The top 2 referrers on this leaderboard each win $25",
    ],
    prizeBreakdown: [
      { label: "🥇 1st Place", value: "$25 crypto" },
      { label: "🥈 2nd Place", value: "$25 crypto" },
    ],
  },
  "free-access": {
    slug: "free-access",
    title: "Refer & Get 2 Months Free",
    subtitle: "Free Signup Referral Campaign",
    description: "Refer the most free signups. The top 10 referrers who each bring in 10+ free users win 2 months of free BountyPilot access. All referrals to users who haven't paid count here.",
    prize: "2 Mo Free",
    prizeLabel: "Per Winner",
    accentClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    icon: <Gift className="w-5 h-5" />,
    type: "access",
    howToWin: [
      "Share your referral link to anyone who signs up for free",
      "Free users (trial, unsubscribed) count on this leaderboard",
      "You need at least 10 free referrals to qualify",
      "Top 10 qualifying referrers each get 2 months free",
    ],
    prizeBreakdown: [
      { label: "Top 10 (10+ refs)", value: "2 months free" },
    ],
  },
  "yearly-challenge": {
    slug: "yearly-challenge",
    title: "Yearly Challenge",
    subtitle: "Yearly Subscriber Campaign",
    description: "Refer the most yearly subscribers. $200 prize pool unlocks progressively as the community of qualified referrers grows. Milestones at 5 and 10 qualified participants.",
    prize: "$200",
    prizeLabel: "Prize Pool",
    accentClass: "text-yellow-500",
    bgClass: "bg-yellow-500/10",
    borderClass: "border-yellow-500/30",
    icon: <Calendar className="w-5 h-5" />,
    type: "crypto",
    howToWin: [
      "Share your referral link with people likely to subscribe yearly",
      "Only yearly plan subscriptions count on this leaderboard",
      "Monthly, lifetime, and free referrals go to their own campaigns",
      "Pool unlocks at 5 qualified referrers (50%) and fully at 10 (100%)",
    ],
    prizeBreakdown: [
      { label: "🥇 1st (50% pool)", value: "$50" },
      { label: "🥈 2nd (50% pool)", value: "$25" },
      { label: "🥇 1st (100% pool)", value: "$100" },
      { label: "🥈 2nd (100% pool)", value: "$50" },
      { label: "3rd–10th (100% pool)", value: "$20 each" },
    ],
  },
  "lifetime-challenge": {
    slug: "lifetime-challenge",
    title: "Lifetime Challenge",
    subtitle: "Lifetime Member Campaign",
    description: "Refer the most lifetime subscribers. $500 prize pool unlocks progressively. Exclusive to those bringing in lifetime members — the highest-value campaign on BountyPilot.",
    prize: "$500",
    prizeLabel: "Prize Pool",
    accentClass: "text-purple-500",
    bgClass: "bg-purple-500/10",
    borderClass: "border-purple-500/30",
    icon: <Star className="w-5 h-5" />,
    type: "crypto",
    howToWin: [
      "Share your referral link with people ready to buy lifetime access",
      "Only lifetime plan subscriptions count on this leaderboard",
      "Monthly, yearly, and free referrals go to their own campaigns",
      "Pool unlocks at 5 qualified referrers (50%) and fully at 10 (100%)",
    ],
    prizeBreakdown: [
      { label: "🥇 1st (50% pool)", value: "$125" },
      { label: "🥈 2nd (50% pool)", value: "$75" },
      { label: "3rd–10th (50% pool)", value: "$50 split" },
      { label: "🥇 1st (100% pool)", value: "$250" },
      { label: "🥈 2nd (100% pool)", value: "$150" },
      { label: "3rd–10th (100% pool)", value: "$50 each" },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard row
// ─────────────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  username: string;
  count: number;
  isYou: boolean;
  isWinner: boolean;
  qualifies?: boolean;
}

function LeaderboardRow({
  entry,
  accentClass,
  borderClass,
  countLabel,
}: {
  entry: LeaderboardEntry;
  accentClass: string;
  borderClass: string;
  countLabel: string;
}) {
  const isTop = entry.rank <= 3;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-sm border text-xs font-mono ${
        entry.isYou
          ? `${borderClass} bg-primary/5`
          : isTop
          ? "border-border bg-background"
          : "border-border/50 bg-background"
      }`}
    >
      <span className={`font-bold w-6 shrink-0 ${isTop ? accentClass : "text-muted-foreground"}`}>
        #{entry.rank}
      </span>
      <span className="flex-1 truncate">
        {entry.username}
        {entry.isYou && <span className={`${accentClass} ml-1 text-[10px]`}>(you)</span>}
      </span>
      <span className={`font-semibold shrink-0 ${accentClass}`}>
        {entry.count} {countLabel}
      </span>
      {entry.rank === 1 && <span className="text-base shrink-0">🥇</span>}
      {entry.rank === 2 && <span className="text-base shrink-0">🥈</span>}
      {entry.rank === 3 && <span className="text-base shrink-0">🥉</span>}
      {entry.isWinner && entry.rank > 3 && <Crown className={`w-3 h-3 shrink-0 ${accentClass}`} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone progress bar (for yearly/lifetime)
// ─────────────────────────────────────────────────────────────────────────────

function MilestoneBar({
  qualifiedCount,
  milestone1,
  milestone2,
  prizePool,
  accentClass,
}: {
  qualifiedCount: number;
  milestone1: number;
  milestone2: number;
  prizePool: number;
  accentClass: string;
}) {
  const pct = Math.min(100, (qualifiedCount / milestone2) * 100);
  const unlocked = qualifiedCount >= milestone1 ? (qualifiedCount >= milestone2 ? 100 : 50) : 0;
  const unlockedAmt = unlocked === 100 ? prizePool : unlocked === 50 ? Math.round(prizePool / 2) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-muted-foreground">Pool unlocked</span>
        <span className={`font-bold ${unlocked > 0 ? accentClass : "text-muted-foreground"}`}>
          {unlocked}% — {unlocked > 0 ? `$${unlockedAmt}` : "locked"}
        </span>
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full transition-all rounded-full ${
            unlocked === 100 ? "bg-primary" : unlocked === 50 ? "bg-yellow-500" : "bg-border"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0</span>
        <span className={qualifiedCount >= milestone1 ? accentClass : ""}>{milestone1} → 50%</span>
        <span className={qualifiedCount >= milestone2 ? accentClass : ""}>{milestone2} → 100%</span>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        {qualifiedCount} qualified referrer{qualifiedCount !== 1 ? "s" : ""} so far
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main campaign detail page
// ─────────────────────────────────────────────────────────────────────────────

export function LaunchpadCampaign() {
  const params = useParams<{ slug: string }>();
  const [location, navigate] = useLocation();
  // useParams() is unreliable inside Wouter's nest context — parse from URL directly
  const slug = params.slug || location.split("/").filter(Boolean).pop() || "";
  const { token, user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const config = CAMPAIGN_CONFIG[slug];

  // Redirect to launchpad if invalid slug
  useEffect(() => {
    if (!config) navigate("/launchpad");
  }, [config, navigate]);

  const referralLink = user
    ? `${window.location.origin}/signup?ref=${encodeURIComponent(user.username)}`
    : null;

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch campaign leaderboard
  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ["campaign-leaderboard", slug],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`/api/referrals/campaigns/${slug}/leaderboard`, { headers });
      return r.json();
    },
    enabled: !!config,
    staleTime: 30_000,
  });

  // Fetch enrollment status
  const { data: campaignData } = useQuery({
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

  const thisCampaign = campaignData?.campaigns?.find(c => c.slug === slug);
  const isEnrolled = thisCampaign?.isEnrolled ?? false;
  const enrolledCount = thisCampaign?.enrolledCount ?? 0;

  const [hasJoined, setHasJoined] = useState(false);
  const joined = isEnrolled || hasJoined;

  // Join campaign mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/referrals/campaigns/${slug}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed to join");
      return r.json();
    },
    onSuccess: () => {
      setHasJoined(true);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  if (!config) return null;

  const leaderboard: LeaderboardEntry[] = lbData?.leaderboard ?? [];
  const countLabel =
    slug === "crypto-50" ? "monthly"
    : slug === "free-access" ? "free"
    : slug === "yearly-challenge" ? "yearly"
    : "lifetime";

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Back + header */}
      <div>
        <button
          onClick={() => navigate("/launchpad")}
          className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Launchpad
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-sm ${config.bgClass} border ${config.borderClass} flex items-center justify-center shrink-0`}>
              <span className={config.accentClass}>{config.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-mono text-[10px] uppercase tracking-wider">
                  Active
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground gap-1 flex items-center">
                  <Clock className="w-2.5 h-2.5" /> Ends Aug 7
                </Badge>
                {joined && (
                  <Badge variant="outline" className={`${config.accentClass} border-current/30 font-mono text-[10px] uppercase tracking-wider`}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Joined
                  </Badge>
                )}
              </div>
              <h1 className="font-bold font-sans text-xl uppercase tracking-tighter">{config.title}</h1>
              <p className="font-mono text-xs text-muted-foreground">{config.subtitle}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`font-bold font-mono text-3xl leading-none ${config.accentClass}`}>{config.prize}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{config.prizeLabel}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <Card className={`bg-card ${config.borderClass}`}>
        <CardContent className="p-4 space-y-3">
          <p className="font-mono text-sm text-muted-foreground leading-relaxed">{config.description}</p>

          {/* Join button + participant count */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{enrolledCount} joined</span>
            </div>

            {!isAuthenticated ? (
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs uppercase tracking-wider"
                onClick={() => navigate("/login")}
              >
                Sign in to join
              </Button>
            ) : joined ? (
              <div className={`flex items-center gap-1.5 font-mono text-xs font-bold ${config.accentClass}`}>
                <CheckCircle2 className="w-4 h-4" /> Joined
              </div>
            ) : (
              <Button
                size="sm"
                className="font-mono text-xs uppercase tracking-wider"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Joining...</>
                ) : (
                  <><Zap className="w-3.5 h-3.5 mr-1.5" /> Join Campaign</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Referral link (auth only) */}
      {isAuthenticated && referralLink && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Your Referral Link</p>
            <div className="flex gap-2">
              <div className="flex-1 font-mono text-xs bg-background border border-border rounded-sm px-3 py-2 truncate text-muted-foreground">
                {referralLink}
              </div>
              <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              Code: <span className={`${config.accentClass} font-bold tracking-widest`}>{user?.username}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Milestone progress (yearly/lifetime only) */}
      {(slug === "yearly-challenge" || slug === "lifetime-challenge") && lbData && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Prize Pool Unlock
            </p>
            <MilestoneBar
              qualifiedCount={lbData.qualifiedCount ?? 0}
              milestone1={slug === "yearly-challenge" ? 5 : 5}
              milestone2={slug === "yearly-challenge" ? 10 : 10}
              prizePool={slug === "yearly-challenge" ? 200 : 500}
              accentClass={config.accentClass}
            />
          </CardContent>
        </Card>
      )}

      {/* Prizes */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Prize Breakdown</p>
          <div className="grid grid-cols-2 gap-2">
            {config.prizeBreakdown.map((p, i) => (
              <div key={i} className={`border ${config.borderClass} ${config.bgClass} rounded-sm px-3 py-2`}>
                <p className={`font-mono text-xs font-bold ${config.accentClass}`}>{p.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{p.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Trophy className={`w-3 h-3 ${config.accentClass}`} />
            Leaderboard — ranked by {countLabel} referrals
          </p>

          {lbLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-8 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
              <p className="font-mono text-xs text-muted-foreground">No referrals yet.</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">Be the first on the board!</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map(entry => (
                <LeaderboardRow
                  key={entry.rank}
                  entry={entry}
                  accentClass={config.accentClass}
                  borderClass={config.borderClass}
                  countLabel={countLabel}
                />
              ))}
            </div>
          )}

          {/* free-access: show user's own position if not in top 10 */}
          {slug === "free-access" && lbData?.myRank && lbData.myRank > 10 && isAuthenticated && (
            <div className={`mt-2 px-3 py-2 rounded-sm border ${config.borderClass} ${config.bgClass} font-mono text-xs`}>
              <span className="text-muted-foreground">Your position: </span>
              <span className={`font-bold ${config.accentClass}`}>#{lbData.myRank}</span>
              <span className="text-muted-foreground ml-2">({lbData.myCount} free refs)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to win */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">How to Win</p>
          <div className="space-y-1.5">
            {config.howToWin.map((step, i) => (
              <p key={i} className="font-mono text-[11px] text-muted-foreground">
                <span className={`${config.accentClass} font-bold`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {" — "}{step}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
