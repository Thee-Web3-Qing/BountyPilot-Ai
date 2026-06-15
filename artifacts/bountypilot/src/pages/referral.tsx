import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Gift, Trophy, Users, Star, Zap } from "lucide-react";

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  qualifies: boolean;
  minRequired: number;
  hasPremiumReferral: boolean;
  referrals: { id: number; referredUserPlan: string; createdAt: string }[];
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalReferrals: number;
  hasPremiumReferral: boolean;
  qualifies: boolean;
}

export function Referral() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [minRequired, setMinRequired] = useState(3);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/referrals/my", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/referrals/leaderboard").then(r => r.json()),
    ]).then(([myStats, lb]) => {
      setStats(myStats);
      setLeaderboard(lb.leaderboard ?? []);
      setMinRequired(lb.minRequired ?? 3);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const copyLink = () => {
    if (!stats) return;
    navigator.clipboard.writeText(stats.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="font-mono text-muted-foreground text-sm animate-pulse">Loading referral data...</div>
      </div>
    );
  }

  const progress = Math.min(100, ((stats?.totalReferrals ?? 0) / minRequired) * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-bold font-sans text-2xl uppercase tracking-tighter flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          Refer & Earn
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Refer creators to BountyPilot. Top 2 referrers win $25 each. All qualifiers get 2 months free.
        </p>
      </div>

      {/* Prize Banner */}
      <div className="bg-primary/10 border border-primary/30 rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold font-mono text-sm uppercase tracking-wider text-primary">$50 Prize Pool</p>
            <p className="font-mono text-xs text-muted-foreground">Top 2 referrers · $25 each in crypto</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:ml-auto">
          <div className="w-10 h-10 bg-card border border-border rounded-sm flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold font-mono text-sm uppercase tracking-wider">1 Month Free</p>
            <p className="font-mono text-xs text-muted-foreground">For all who hit the threshold</p>
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Your Referral Link</p>
          <div className="flex gap-2">
            <div className="flex-1 font-mono text-sm bg-background border border-border rounded-sm px-3 py-2 truncate text-muted-foreground">
              {stats?.referralLink ?? "Loading..."}
            </div>
            <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0 font-mono">
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Code: <span className="text-primary font-bold tracking-widest">{stats?.referralCode ?? "—"}</span>
          </p>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Your Progress</p>
            {stats?.qualifies ? (
              <Badge className="bg-primary text-primary-foreground font-mono text-xs">✓ Qualified</Badge>
            ) : (
              <Badge variant="outline" className="font-mono text-xs">{stats?.totalReferrals ?? 0} / {minRequired}</Badge>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-background border border-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background border border-border rounded-sm p-3">
              <p className="font-mono text-2xl font-bold text-primary">{stats?.totalReferrals ?? 0}</p>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Referrals</p>
            </div>
            <div className="bg-background border border-border rounded-sm p-3">
              <p className="font-mono text-2xl font-bold">{minRequired - (stats?.totalReferrals ?? 0) > 0 ? minRequired - (stats?.totalReferrals ?? 0) : 0}</p>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Needed</p>
            </div>
          </div>

          {stats?.hasPremiumReferral && (
            <div className="flex items-center gap-2 text-primary font-mono text-xs border border-primary/30 bg-primary/5 px-3 py-2 rounded-sm">
              <Star className="w-4 h-4" />
              You referred a premium subscriber — auto-qualified!
            </div>
          )}

          <div className="font-mono text-xs text-muted-foreground space-y-1">
            <p>• Refer <strong>3+ creators</strong> (any plan) to qualify</p>
            <p>• Or refer <strong>1 annual/lifetime</strong> subscriber</p>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Leaderboard</p>
          </div>
          {leaderboard.length === 0 ? (
            <p className="font-mono text-sm text-muted-foreground">No referrals yet — be the first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-3 px-3 py-2 rounded-sm border ${
                    entry.username === user?.username
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background"
                  }`}
                >
                  <span className={`font-mono text-sm font-bold w-6 ${entry.rank <= 2 ? "text-primary" : "text-muted-foreground"}`}>
                    #{entry.rank}
                  </span>
                  <span className="font-mono text-sm flex-1">
                    {entry.username}
                    {entry.username === user?.username && (
                      <span className="text-primary ml-2 text-xs">(you)</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{entry.totalReferrals} refs</span>
                  {entry.qualifies && (
                    <Badge className="bg-primary text-primary-foreground font-mono text-xs px-1.5">✓</Badge>
                  )}
                  {entry.rank <= 2 && (
                    <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-3">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">How It Works</p>
          <div className="space-y-2 font-mono text-sm text-muted-foreground">
            <p><span className="text-primary">01</span> — Share your referral link with fellow creators</p>
            <p><span className="text-primary">02</span> — They sign up using your link</p>
            <p><span className="text-primary">03</span> — Refer 3 people (or 1 premium sub) to qualify</p>
            <p><span className="text-primary">04</span> — Top 2 referrers win $25 each in crypto at campaign end</p>
            <p><span className="text-primary">05</span> — All qualifiers get 2 months free access on launch</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
