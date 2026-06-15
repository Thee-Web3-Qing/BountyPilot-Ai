import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Clock, Coins, Users, CheckCircle, Loader2,
  Trophy, Zap, Copy, Check, Crown, ChevronDown, ChevronUp, Star,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CustomBounty {
  id: number;
  title: string;
  description: string;
  requirements: string | null;
  reward: string;
  rewardToken: string;
  rewardType: string;
  category: string;
  maxParticipants: number | null;
  deadline: string | null;
  status: string;
  featured: boolean;
  createdAt: string;
}

interface Application {
  bountyId: number;
  status: string;
}

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  paidReferrals: number;
  qualifiesCrypto: boolean;
  qualifiesAccess: boolean;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalReferrals: number;
  paidReferrals: number;
  isWinner: boolean;
}

interface LeaderboardData {
  paidLeaderboard: LeaderboardEntry[];
  freeLeaderboard: LeaderboardEntry[];
  freeLeaderboardMin: number;
  freeLeaderboardTop: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeLeft(deadline: string | null) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3600000);
  return `${hours}h left`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared hook: loads referral stats + leaderboard once on expand
// ─────────────────────────────────────────────────────────────────────────────

function useReferralData(token: string | null, expanded: boolean) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [lb, setLb] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded || lb) return;
    setLoading(true);
    Promise.all([
      token
        ? fetch("/api/referrals/my", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        : Promise.resolve(null),
      fetch("/api/referrals/leaderboard").then(r => r.json()),
    ]).then(([myStats, lbData]) => {
      setStats(myStats);
      setLb(lbData);
    }).finally(() => setLoading(false));
  }, [expanded, token, lb]);

  return { stats, lb, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounty Card 1: $50 Crypto — paid referrals track
// ─────────────────────────────────────────────────────────────────────────────

function CryptoBountyCard() {
  const { token, user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { stats, lb, loading } = useReferralData(token, expanded);

  const copyLink = () => {
    if (!stats?.referralLink) return;
    navigator.clipboard.writeText(stats.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-card border-primary/40 overflow-hidden">
      <div className="h-1 bg-primary w-full" />
      <CardContent className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className="bg-primary text-primary-foreground font-mono text-xs">Featured</Badge>
              <Badge variant="outline" className="font-mono text-xs">referral</Badge>
              <span className="font-mono text-[10px] text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                🟢 Active
              </span>
            </div>
            <h3 className="font-bold font-sans text-base uppercase tracking-tight flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              Refer & Win $50 Crypto
            </h3>
            <p className="font-mono text-xs text-muted-foreground mt-1 leading-relaxed">
              Refer the most paying users. The top 2 referrers each win <span className="text-primary font-bold">$25 in crypto</span> paid directly to their wallet.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold font-mono text-2xl text-primary">$50</p>
            <p className="font-mono text-[10px] text-muted-foreground">prize pool</p>
          </div>
        </div>

        {/* Prize details */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="border border-primary/20 bg-primary/5 rounded-sm px-3 py-2">
            <p className="text-primary font-bold">🥇 1st Place</p>
            <p className="text-muted-foreground">$25 crypto</p>
          </div>
          <div className="border border-primary/20 bg-primary/5 rounded-sm px-3 py-2">
            <p className="text-primary font-bold">🥈 2nd Place</p>
            <p className="text-muted-foreground">$25 crypto</p>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Open to all</span>
            <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> Crypto payout</span>
          </div>
          <Button
            size="sm"
            variant={expanded ? "outline" : "default"}
            className="font-mono text-xs uppercase tracking-wider"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Close</> : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View & Join</>}
          </Button>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-border pt-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Referral link */}
                {stats && (
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Your Referral Link</p>
                    <div className="flex gap-2">
                      <div className="flex-1 font-mono text-xs bg-background border border-border rounded-sm px-3 py-2 truncate text-muted-foreground">
                        {stats.referralLink}
                      </div>
                      <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0">
                        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Code: <span className="text-primary font-bold tracking-widest">{stats.referralCode}</span>
                      {stats.qualifiesCrypto && <span className="ml-3 text-primary">✓ You qualify for this prize</span>}
                    </p>
                  </div>
                )}

                {/* My stat */}
                {stats && (
                  <div className="bg-background border border-primary/20 rounded-sm px-4 py-3">
                    <p className="font-mono text-2xl font-bold text-primary">{stats.paidReferrals}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">Paid referrals so far</p>
                  </div>
                )}

                {/* Leaderboard */}
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-primary" /> Leaderboard — ranked by paid referrals
                  </p>
                  {(lb?.paidLeaderboard?.length ?? 0) === 0 ? (
                    <div className="py-6 text-center">
                      <p className="font-mono text-xs text-muted-foreground">No paid referrals yet.</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">Be the first to get on the board!</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {lb!.paidLeaderboard.slice(0, 10).map(entry => (
                        <div
                          key={entry.rank}
                          className={`flex items-center gap-2 px-3 py-2 rounded-sm border text-xs font-mono ${
                            entry.username === user?.username
                              ? "border-primary/40 bg-primary/5"
                              : entry.rank <= 2
                              ? "border-primary/20 bg-primary/5"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className={`font-bold w-5 ${entry.rank <= 2 ? "text-primary" : "text-muted-foreground"}`}>
                            #{entry.rank}
                          </span>
                          <span className="flex-1 truncate">
                            {entry.username}
                            {entry.username === user?.username && <span className="text-primary ml-1 text-[10px]">(you)</span>}
                          </span>
                          <span className="text-primary font-semibold">{entry.paidReferrals} paid</span>
                          {entry.rank === 1 && <span className="text-base">🥇</span>}
                          {entry.rank === 2 && <span className="text-base">🥈</span>}
                          {entry.rank <= 2 && <Crown className="w-3 h-3 text-primary shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* How to */}
                <div className="bg-background border border-border rounded-sm p-3 space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">How to win</p>
                  <div className="font-mono text-[11px] text-muted-foreground space-y-1">
                    <p><span className="text-primary">01</span> — Copy your referral link above</p>
                    <p><span className="text-primary">02</span> — Share it with people who'd pay for BountyPilot</p>
                    <p><span className="text-primary">03</span> — Each user who <span className="text-primary font-bold">pays</span> (monthly, yearly, or lifetime) counts</p>
                    <p><span className="text-primary">04</span> — Top 2 referrers of paid users win <span className="text-primary font-bold">$25 each</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounty Card 2: 2 Months Free — total referrals track
// ─────────────────────────────────────────────────────────────────────────────

function AccessBountyCard() {
  const { token, user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { stats, lb, loading } = useReferralData(token, expanded);

  const copyLink = () => {
    if (!stats?.referralLink) return;
    navigator.clipboard.writeText(stats.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minRefs = lb?.freeLeaderboardMin ?? 10;
  const topN = lb?.freeLeaderboardTop ?? 10;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="h-1 bg-foreground/20 w-full" />
      <CardContent className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="font-mono text-xs">referral</Badge>
              <Badge variant="outline" className="font-mono text-xs">access</Badge>
              <span className="font-mono text-[10px] text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                🟢 Active
              </span>
            </div>
            <h3 className="font-bold font-sans text-base uppercase tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              Refer & Get 2 Months Free
            </h3>
            <p className="font-mono text-xs text-muted-foreground mt-1 leading-relaxed">
              Refer anyone — free or paid. The top {topN} referrers with at least {minRefs} total referrals each win <span className="text-foreground font-bold">2 months of free access</span>.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold font-mono text-2xl">2mo</p>
            <p className="font-mono text-[10px] text-muted-foreground">free access</p>
          </div>
        </div>

        {/* Prize details */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="border border-border rounded-sm px-3 py-2">
            <p className="font-bold">Top {topN} win</p>
            <p className="text-muted-foreground">2 months free access</p>
          </div>
          <div className="border border-border rounded-sm px-3 py-2">
            <p className="font-bold">Min. threshold</p>
            <p className="text-muted-foreground">{minRefs}+ total referrals</p>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Open to all</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Free or paid refs</span>
          </div>
          <Button
            size="sm"
            variant={expanded ? "outline" : "default"}
            className="font-mono text-xs uppercase tracking-wider"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5 mr-1" /> Close</> : <><ChevronDown className="w-3.5 h-3.5 mr-1" /> View & Join</>}
          </Button>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-border pt-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Referral link */}
                {stats && (
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Your Referral Link</p>
                    <div className="flex gap-2">
                      <div className="flex-1 font-mono text-xs bg-background border border-border rounded-sm px-3 py-2 truncate text-muted-foreground">
                        {stats.referralLink}
                      </div>
                      <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0">
                        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Code: <span className="text-primary font-bold tracking-widest">{stats.referralCode}</span>
                      {stats.qualifiesAccess && <span className="ml-3 text-primary">✓ You're on the leaderboard</span>}
                    </p>
                  </div>
                )}

                {/* My stat */}
                {stats && (
                  <div className="bg-background border border-border rounded-sm px-4 py-3">
                    <p className="font-mono text-2xl font-bold">{stats.totalReferrals}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Total referrals · need {Math.max(0, minRefs - stats.totalReferrals)} more to qualify
                    </p>
                  </div>
                )}

                {/* Leaderboard */}
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3 h-3 text-primary" /> Leaderboard — ranked by total referrals · min {minRefs} to appear
                  </p>
                  {(lb?.freeLeaderboard?.length ?? 0) === 0 ? (
                    <div className="py-6 text-center">
                      <p className="font-mono text-xs text-muted-foreground">Nobody's hit {minRefs} referrals yet.</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-1">Be the first to unlock this leaderboard!</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {lb!.freeLeaderboard.map(entry => (
                        <div
                          key={entry.rank}
                          className={`flex items-center gap-2 px-3 py-2 rounded-sm border text-xs font-mono ${
                            entry.username === user?.username
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className={`font-bold w-5 ${entry.rank <= 3 ? "text-foreground" : "text-muted-foreground"}`}>
                            #{entry.rank}
                          </span>
                          <span className="flex-1 truncate">
                            {entry.username}
                            {entry.username === user?.username && <span className="text-primary ml-1 text-[10px]">(you)</span>}
                          </span>
                          <span className="font-semibold">{entry.totalReferrals} refs</span>
                          <Zap className="w-3 h-3 text-primary shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* How to */}
                <div className="bg-background border border-border rounded-sm p-3 space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">How to win</p>
                  <div className="font-mono text-[11px] text-muted-foreground space-y-1">
                    <p><span className="text-primary">01</span> — Copy your referral link above</p>
                    <p><span className="text-primary">02</span> — Share it anywhere — anyone who signs up counts</p>
                    <p><span className="text-primary">03</span> — Reach <span className="text-foreground font-bold">{minRefs}+ total referrals</span> to appear on the leaderboard</p>
                    <p><span className="text-primary">04</span> — Stay in the top {topN} → win <span className="text-foreground font-bold">2 months free access</span></p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply Modal (for admin bounties)
// ─────────────────────────────────────────────────────────────────────────────

function ApplyModal({ bounty, onClose, onSubmit }: {
  bounty: CustomBounty;
  onClose: () => void;
  onSubmit: (note: string, url: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(note, url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="p-6 space-y-4">
          <h2 className="font-bold font-sans text-lg uppercase tracking-tighter">Apply: {bounty.title}</h2>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Tell us how you'll complete this</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Describe your plan, relevant experience, or content idea..."
                className="w-full h-28 bg-background border border-border rounded-sm px-3 py-2 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Portfolio / previous work URL (optional)</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-background border border-border rounded-sm px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 font-mono">Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1 font-mono uppercase tracking-wider">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Launchpad page
// ─────────────────────────────────────────────────────────────────────────────

export function Launchpad() {
  const { token, isAuthenticated } = useAuth();
  const [bounties, setBounties] = useState<CustomBounty[]>([]);
  const [myApps, setMyApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<CustomBounty | null>(null);
  const [success, setSuccess] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/custom-bounties").then(r => r.json()),
      isAuthenticated
        ? fetch("/api/custom-bounties/my/applications", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => [])
        : Promise.resolve([]),
    ]).then(([b, apps]) => {
      setBounties(Array.isArray(b) ? b : []);
      setMyApps(Array.isArray(apps) ? apps : []);
    }).finally(() => setLoading(false));
  }, [token, isAuthenticated]);

  const handleApply = async (note: string, url: string) => {
    if (!applying) return;
    const resp = await fetch(`/api/custom-bounties/${applying.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ submissionNote: note, submissionUrl: url }),
    });
    if (!resp.ok) {
      const d = await resp.json();
      throw new Error(d.error || "Failed to apply");
    }
    setMyApps(prev => [...prev, { bountyId: applying.id, status: "pending" }]);
    setSuccess(applying.id);
    setTimeout(() => setSuccess(null), 4000);
  };

  const getAppStatus = (bountyId: number) => myApps.find(a => a.bountyId === bountyId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="font-mono text-muted-foreground text-sm animate-pulse">Loading launchpad...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="mb-2">
        <h1 className="font-bold font-sans text-2xl uppercase tracking-tighter flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Launchpad
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Exclusive bounties posted by BountyPilot. Complete tasks, earn rewards.
        </p>
      </div>

      {/* Referral bounties — two separate cards */}
      <CryptoBountyCard />
      <AccessBountyCard />

      {/* Admin-created bounties */}
      {bounties.length > 0 && (
        <div className="space-y-4 pt-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-1">More Bounties</p>
          {bounties.map((bounty) => {
            const appStatus = getAppStatus(bounty.id);
            const tl = timeLeft(bounty.deadline);
            return (
              <Card key={bounty.id} className={`bg-card border-border ${bounty.featured ? "border-primary/40" : ""}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {bounty.featured && <Badge className="bg-primary text-primary-foreground font-mono text-xs">Featured</Badge>}
                        <Badge variant="outline" className="font-mono text-xs capitalize">{bounty.category}</Badge>
                      </div>
                      <h3 className="font-bold font-sans text-base uppercase tracking-tight">{bounty.title}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold font-mono text-lg text-primary">${bounty.reward}</p>
                      <p className="font-mono text-xs text-muted-foreground">{bounty.rewardToken}</p>
                    </div>
                  </div>

                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">{bounty.description}</p>

                  {bounty.requirements && (
                    <div className="bg-background border border-border rounded-sm p-3">
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">Requirements</p>
                      <p className="font-mono text-xs text-muted-foreground">{bounty.requirements}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    {tl && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{tl}</span>}
                    {bounty.maxParticipants && <span className="flex items-center gap-1"><Users className="w-3 h-3" />Max {bounty.maxParticipants}</span>}
                    <span className="flex items-center gap-1"><Coins className="w-3 h-3" />{bounty.rewardType === "crypto" ? "Crypto payout" : "Access reward"}</span>
                  </div>

                  <div className="flex justify-end">
                    {success === bounty.id ? (
                      <div className="flex items-center gap-2 text-primary font-mono text-sm">
                        <CheckCircle className="w-4 h-4" /> Application submitted!
                      </div>
                    ) : appStatus ? (
                      <Badge variant="outline" className="font-mono text-xs capitalize">Applied — {appStatus.status}</Badge>
                    ) : !isAuthenticated ? (
                      <Button variant="outline" size="sm" className="font-mono" onClick={() => window.location.href = "/login"}>
                        Sign in to apply
                      </Button>
                    ) : (
                      <Button size="sm" className="font-mono uppercase tracking-wider" onClick={() => setApplying(bounty)}>
                        Apply
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state — only when no admin bounties */}
      {bounties.length === 0 && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-10 text-center">
            <Star className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="font-mono text-sm text-muted-foreground">More bounties coming soon.</p>
          </CardContent>
        </Card>
      )}

      {applying && (
        <ApplyModal
          bounty={applying}
          onClose={() => setApplying(null)}
          onSubmit={handleApply}
        />
      )}
    </div>
  );
}
