import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Gift, Trophy, Users, Star, Zap, Crown, Lock } from "lucide-react";

interface ReferredUser {
  id: number;
  referredUserId: number;
  referredUsername: string;
  referredUserPlan: string;
  isPaid: boolean;
  createdAt: string;
}

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  paidReferrals: number;
  qualifiesCrypto: boolean;
  qualifiesAccess: boolean;
  minRequired: number;
  freeLeaderboardMin: number;
  hasPremiumReferral: boolean;
  referrals: ReferredUser[];
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalReferrals: number;
  paidReferrals: number;
  points: number;
  isWinner: boolean;
  qualifies: boolean;
}

interface LeaderboardData {
  paidLeaderboard: LeaderboardEntry[];
  freeLeaderboard: LeaderboardEntry[];
  minRequired: number;
  freeLeaderboardMin: number;
  freeLeaderboardTop: number;
  cryptoPrizeTop: number;
}

export function Referral() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [lb, setLb] = useState<LeaderboardData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"crypto" | "access">("crypto");

  useEffect(() => {
    Promise.all([
      fetch("/api/referrals/my", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/referrals/leaderboard").then(r => r.json()),
    ]).then(([myStats, lbData]) => {
      setStats(myStats);
      setLb(lbData);
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

  const cryptoProgress = Math.min(100, ((stats?.paidReferrals ?? 0) / (lb?.minRequired ?? 3)) * 100);
  const accessProgress = Math.min(100, ((stats?.totalReferrals ?? 0) / (lb?.freeLeaderboardMin ?? 10)) * 100);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-bold font-sans text-2xl uppercase tracking-tighter flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          Refer & Earn
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Two reward tracks. Refer creators and climb both leaderboards.
        </p>
      </div>

      {/* Two prize tracks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Crypto track */}
        <div className="bg-primary/10 border border-primary/30 rounded-sm p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold font-mono text-xs uppercase tracking-wider text-primary">$50 Crypto Pool</p>
              <p className="font-mono text-[10px] text-muted-foreground">Top 2 referrers of paid users</p>
            </div>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Refer <strong className="text-foreground">paid subscribers</strong>. Top 2 split $50 in crypto — $25 each.
          </p>
          {stats?.qualifiesCrypto && (
            <Badge className="bg-primary text-primary-foreground font-mono text-[10px]">✓ You qualify</Badge>
          )}
        </div>

        {/* Access track */}
        <div className="bg-card border border-border rounded-sm p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted border border-border rounded-sm flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold font-mono text-xs uppercase tracking-wider text-foreground">2 Months Free</p>
              <p className="font-mono text-[10px] text-muted-foreground">Top 10 referrers (free or paid)</p>
            </div>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Refer <strong className="text-foreground">anyone</strong>. Top 10 with 10+ referrals get 2 months free on launch.
          </p>
          {stats?.qualifiesAccess && (
            <Badge className="bg-foreground text-background font-mono text-[10px]">✓ On leaderboard</Badge>
          )}
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

      {/* Progress — both tracks */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-5">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Your Progress</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background border border-primary/30 rounded-sm p-3">
              <p className="font-mono text-2xl font-bold text-primary">{stats?.paidReferrals ?? 0}</p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Paid referrals</p>
              <p className="font-mono text-[10px] text-muted-foreground">for $50 crypto track</p>
            </div>
            <div className="bg-background border border-border rounded-sm p-3">
              <p className="font-mono text-2xl font-bold">{stats?.totalReferrals ?? 0}</p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total referrals</p>
              <p className="font-mono text-[10px] text-muted-foreground">for 2-months track</p>
            </div>
          </div>

          {/* Crypto track progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] text-primary uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3 h-3" /> $50 Crypto Track
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {stats?.paidReferrals ?? 0} / {lb?.minRequired ?? 3} paid refs to qualify
              </span>
            </div>
            <div className="w-full h-1.5 bg-background border border-border rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${cryptoProgress}%` }} />
            </div>
            {stats?.qualifiesCrypto ? (
              <p className="font-mono text-[10px] text-primary">✓ Qualified — now climb the paid leaderboard!</p>
            ) : (
              <p className="font-mono text-[10px] text-muted-foreground">
                {(lb?.minRequired ?? 3) - (stats?.paidReferrals ?? 0)} more paid referral{((lb?.minRequired ?? 3) - (stats?.paidReferrals ?? 0)) !== 1 ? "s" : ""} to qualify
              </p>
            )}
          </div>

          {/* Access track progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] text-foreground uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" /> 2 Months Free Track
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {stats?.totalReferrals ?? 0} / {lb?.freeLeaderboardMin ?? 10} total refs minimum
              </span>
            </div>
            <div className="w-full h-1.5 bg-background border border-border rounded-full overflow-hidden">
              <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${accessProgress}%` }} />
            </div>
            {stats?.qualifiesAccess ? (
              <p className="font-mono text-[10px] text-green-400">✓ On the leaderboard — keep referring to hold your spot!</p>
            ) : (
              <p className="font-mono text-[10px] text-muted-foreground">
                {(lb?.freeLeaderboardMin ?? 10) - (stats?.totalReferrals ?? 0)} more to appear on the access leaderboard
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Who You've Referred */}
      {(stats?.referrals?.length ?? 0) > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Your Referrals
              </p>
              <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Paid</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-border inline-block" /> Free</span>
              </div>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {stats!.referrals.map(r => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-sm border ${
                    r.isPaid ? "border-primary/30 bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.isPaid ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <span className="font-mono text-sm flex-1">@{r.referredUsername}</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                    r.isPaid
                      ? "text-primary bg-primary/10 border-primary/30"
                      : "text-muted-foreground border-border"
                  }`}>
                    {r.isPaid ? r.referredUserPlan : "free"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/50">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              Paid users count toward the <span className="text-primary">$50 crypto</span> track. All users count toward the <span className="text-foreground">2 months free</span> track.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dual Leaderboard */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-1 border-b border-border pb-1">
            <button
              onClick={() => setActiveTab("crypto")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                activeTab === "crypto"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> $50 Crypto
            </button>
            <button
              onClick={() => setActiveTab("access")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                activeTab === "access"
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> 2 Months Free
            </button>
          </div>

          {activeTab === "crypto" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground">
                Ranked by <strong className="text-foreground">paid referrals</strong>. Top 2 win $25 each. Minimum {lb?.minRequired ?? 3} paid referrals to qualify.
              </p>
              {(lb?.paidLeaderboard?.length ?? 0) === 0 ? (
                <p className="font-mono text-sm text-muted-foreground py-4 text-center">No paid referrals yet — be the first!</p>
              ) : (
                <div className="space-y-2">
                  {lb!.paidLeaderboard.map(entry => (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-3 px-3 py-2 rounded-sm border ${
                        entry.username === user?.username
                          ? "border-primary/40 bg-primary/5"
                          : entry.isWinner ? "border-primary/20 bg-primary/5"
                          : "border-border bg-background"
                      }`}
                    >
                      <span className={`font-mono text-sm font-bold w-6 ${entry.rank <= 2 ? "text-primary" : "text-muted-foreground"}`}>
                        #{entry.rank}
                      </span>
                      <span className="font-mono text-sm flex-1 truncate">
                        {entry.username}
                        {entry.username === user?.username && <span className="text-primary ml-2 text-xs">(you)</span>}
                      </span>
                      <span className="font-mono text-xs text-primary font-semibold">{entry.paidReferrals} paid</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{entry.totalReferrals} total</span>
                      {entry.rank <= 2 && entry.qualifies && (
                        <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                      {entry.qualifies && entry.rank > 2 && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-[10px] px-1.5">✓</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] text-muted-foreground">
                Ranked by <strong className="text-foreground">total referrals</strong>. Top 10 with {lb?.freeLeaderboardMin ?? 10}+ referrals get 2 months free. Rankings update in real time.
              </p>
              {(lb?.freeLeaderboard?.length ?? 0) === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <Lock className="w-6 h-6 mx-auto text-muted-foreground/30" />
                  <p className="font-mono text-sm text-muted-foreground">No one has hit {lb?.freeLeaderboardMin ?? 10} referrals yet.</p>
                  <p className="font-mono text-xs text-muted-foreground">Be the first to unlock this leaderboard!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lb!.freeLeaderboard.map(entry => (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-3 px-3 py-2 rounded-sm border ${
                        entry.username === user?.username
                          ? "border-foreground/40 bg-foreground/5"
                          : "border-border bg-background"
                      }`}
                    >
                      <span className={`font-mono text-sm font-bold w-6 ${entry.rank <= 3 ? "text-foreground" : "text-muted-foreground"}`}>
                        #{entry.rank}
                      </span>
                      <span className="font-mono text-sm flex-1 truncate">
                        {entry.username}
                        {entry.username === user?.username && <span className="text-primary ml-2 text-xs">(you)</span>}
                      </span>
                      <span className="font-mono text-xs font-semibold">{entry.totalReferrals} refs</span>
                      {entry.paidReferrals > 0 && (
                        <span className="font-mono text-[10px] text-primary">{entry.paidReferrals} paid</span>
                      )}
                      <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {/* User's position if not in top 10 */}
              {stats && !lb?.freeLeaderboard.some(e => e.username === user?.username) && stats.totalReferrals > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="flex items-center gap-3 px-3 py-2 rounded-sm border border-foreground/20 bg-foreground/5">
                    <span className="font-mono text-sm font-bold w-6 text-muted-foreground">—</span>
                    <span className="font-mono text-sm flex-1">{user?.username} <span className="text-primary ml-2 text-xs">(you)</span></span>
                    <span className="font-mono text-xs">{stats.totalReferrals} refs</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {Math.max(0, (lb?.freeLeaderboardMin ?? 10) - stats.totalReferrals)} more to appear
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 space-y-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">How It Works</p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="font-mono text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> $50 Crypto Track
              </p>
              <div className="space-y-1 font-mono text-xs text-muted-foreground ml-5">
                <p><span className="text-primary">01</span> — Share your link with creators</p>
                <p><span className="text-primary">02</span> — They sign up and pay for a plan</p>
                <p><span className="text-primary">03</span> — Get {lb?.minRequired ?? 3}+ paid referrals to qualify</p>
                <p><span className="text-primary">04</span> — Top 2 referrers split $50 in crypto at campaign end</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-mono text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" /> 2 Months Free Track
              </p>
              <div className="space-y-1 font-mono text-xs text-muted-foreground ml-5">
                <p><span className="text-foreground">01</span> — Refer anyone — free or paid</p>
                <p><span className="text-foreground">02</span> — Hit {lb?.freeLeaderboardMin ?? 10}+ total referrals to appear on the leaderboard</p>
                <p><span className="text-foreground">03</span> — Stay in the top 10 — rankings shift in real time</p>
                <p><span className="text-foreground">04</span> — Top 10 at campaign end get 2 months free access</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
