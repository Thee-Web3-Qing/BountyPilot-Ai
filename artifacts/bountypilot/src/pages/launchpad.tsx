import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Rocket, Trophy, Gift, Calendar, Star, ArrowRight, Users, Loader2,
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Launchpad page
// ─────────────────────────────────────────────────────────────────────────────

export function Launchpad() {
  const [, navigate] = useLocation();
  const { token } = useAuth();

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
                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{info?.enrolledCount ?? 0} joined</span>
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
