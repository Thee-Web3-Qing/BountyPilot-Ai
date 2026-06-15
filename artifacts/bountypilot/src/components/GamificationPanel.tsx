import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Star, Zap, Flame, Rocket, Gem, Award, Clock } from "lucide-react";

interface Badge {
  key: string;
  label: string;
  description: string;
  emoji: string;
  earnedAt: string;
}

interface GamificationData {
  points: number;
  badges: Badge[];
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  first_win:            <Trophy className="w-5 h-5" />,
  ten_bounties:         <Zap className="w-5 h-5" />,
  fifty_bounties:       <Flame className="w-5 h-5" />,
  five_hundred_earned:  <Star className="w-5 h-5" />,
  one_thousand_earned:  <Gem className="w-5 h-5" />,
  five_thousand_earned: <Rocket className="w-5 h-5" />,
};

const ALL_BADGES = [
  { key: "first_win",            label: "First Win",   description: "Log your first bounty earning",    emoji: "🏆" },
  { key: "ten_bounties",         label: "10 Bounties", description: "Win 10 bounties",                  emoji: "⚡" },
  { key: "fifty_bounties",       label: "50 Bounties", description: "Win 50 bounties",                  emoji: "🔥" },
  { key: "five_hundred_earned",  label: "$500 Earned", description: "Cumulative earnings reach $500",   emoji: "💰" },
  { key: "one_thousand_earned",  label: "$1K Earned",  description: "Cumulative earnings reach $1,000", emoji: "💎" },
  { key: "five_thousand_earned", label: "$5K Earned",  description: "Cumulative earnings reach $5,000", emoji: "🚀" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function ActivityFeed({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span className="text-4xl">🎯</span>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed max-w-xs">
          No badges yet — log your first bounty earning to start unlocking milestones.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {badges.map((badge, idx) => (
        <div key={`${badge.key}-${badge.earnedAt}`} className="flex gap-3 group">
          {/* Timeline spine */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-base">
              {badge.emoji}
            </div>
            {idx < badges.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[16px]" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-foreground">{badge.label}</span>
              <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-sm px-1.5 py-0.5">
                unlocked
              </span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-tight">
              {badge.description}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatRelative(badge.earnedAt)} · {formatDate(badge.earnedAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GamificationPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/gamification/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return null;

  const earnedKeys = new Set((data?.badges ?? []).map((b) => b.key));
  const earnedMap = Object.fromEntries((data?.badges ?? []).map((b) => [b.key, b]));
  const sortedBadges = [...(data?.badges ?? [])].sort(
    (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime()
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Points */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Bounty Points</p>
            <p className="font-bold text-3xl font-sans">{(data?.points ?? 0).toLocaleString()}</p>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">1 pt per $1 earned · resets on the leaderboard</p>
          </div>
        </CardContent>
      </Card>

      {/* Badges grid */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Milestone Badges</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ALL_BADGES.map((badge) => {
              const earned = earnedKeys.has(badge.key);
              const earnedBadge = earnedMap[badge.key];
              return (
                <div
                  key={badge.key}
                  className={`flex flex-col items-center gap-2 p-3 rounded-sm border text-center transition-all ${
                    earned
                      ? "border-primary/40 bg-primary/8"
                      : "border-border bg-background opacity-40 grayscale"
                  }`}
                >
                  <span className="text-2xl">{badge.emoji}</span>
                  <div>
                    <p className={`font-mono text-xs font-semibold ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                      {badge.label}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {badge.description}
                    </p>
                    {earned && earnedBadge && (
                      <p className="font-mono text-[10px] text-primary mt-1">
                        ✓ {formatDate(earnedBadge.earnedAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Activity feed */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Badge Activity</p>
            {sortedBadges.length > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {sortedBadges.length} unlock{sortedBadges.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <ActivityFeed badges={sortedBadges} />
        </CardContent>
      </Card>
    </div>
  );
}
