import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, User, Calendar, Pencil, Star, Crown, Sparkles, Globe, Award, Coins, Gift, Zap, Target } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/lib/use-page-meta";

interface ProfileData {
  fullName?: string;
  creatorName?: string;
  mainPlatforms?: string;
  contentFormats?: string;
  niche?: string;
  skillLevel?: string;
  preferredBountyTypes?: string;
  minimumReward?: number;
  weeklyContentCapacity?: number;
  targetMonthlyEarnings?: number;
  creatorStrengths?: string;
  creatorWeaknesses?: string;
  portfolioLinks?: string;
  notes?: string;
}

function formatDate(date: string | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function computeSubscriptionStatus(user: any) {
  if (!user) return null;
  if (user.plan === "lifetime") return { plan: "Lifetime", label: "Unlimited", color: "text-green-400" };
  if (user.plan === "active" && user.subscriptionEndsAt) {
    const end = new Date(user.subscriptionEndsAt);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      plan: "Active",
      label: daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Expired",
      color: daysLeft > 0 ? "text-green-400" : "text-red-400",
      endsAt: formatDate(user.subscriptionEndsAt),
    };
  }
  if (user.plan === "trial" || user.plan === "pending") {
    const end = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
    const now = new Date();
    if (end && end > now) {
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        plan: "Trial",
        label: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
        color: "text-amber-400",
        endsAt: formatDate(user.trialEndsAt),
      };
    }
    return { plan: "Expired", label: "Trial ended", color: "text-red-400" };
  }
  return { plan: user.plan, label: "", color: "text-muted-foreground" };
}

function chipList(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function Profile() {
  usePageMeta({ title: "Profile", description: "Your BountyPilot profile", canonical: "/profile" });
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [starCount, setStarCount] = useState(0);
  const [bountyCount, setBountyCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [earningsTotal, setEarningsTotal] = useState(0);

  const subStatus = computeSubscriptionStatus(user);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/checkin/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ totalStars: 0 })),
      fetch("/api/bounties", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ bounties: [] })),
      fetch("/api/submissions", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ submissions: [] })),
      fetch("/api/earnings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({ totalEarned: 0 })),
    ]).then(([me, checkin, bounties, submissions, earnings]) => {
      if (me.profile) setProfile(me.profile);
      setStarCount(checkin.totalStars || 0);
      setBountyCount(bounties.bounties?.length || 0);
      setSubmissionCount(submissions.submissions?.length || 0);
      setEarningsTotal(earnings.totalEarned || 0);
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground font-mono">
        <Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading profile...
      </div>
    );
  }

  const platforms = chipList(profile.mainPlatforms);
  const niches = chipList(profile.niche);
  const formats = chipList(profile.contentFormats);
  const bountyTypes = chipList(profile.preferredBountyTypes);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Profile Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">
              {profile.fullName || profile.creatorName || `@${user?.username}`}
            </h1>
            <p className="text-muted-foreground font-mono text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {subStatus && (
                <span className={`font-mono text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-sm ${subStatus.color} border-current/30`}>
                  {subStatus.plan}
                </span>
              )}
              {profile.skillLevel && (
                <span className="font-mono text-[10px] text-primary uppercase tracking-wider border border-primary/30 px-2 py-0.5 rounded-sm">
                  {profile.skillLevel}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link href="/profile/edit">
          <Button size="sm" variant="outline" className="font-mono text-xs uppercase tracking-wider gap-2">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Star} label="Stars" value={starCount} color="text-amber-400" />
        <StatCard icon={Target} label="Bounties" value={bountyCount} color="text-primary" />
        <StatCard icon={Award} label="Submissions" value={submissionCount} color="text-blue-400" />
        <StatCard icon={Coins} label="Earnings" value={`$${earningsTotal}`} color="text-green-400" />
      </div>

      {/* About */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">About</p>
            <Link href="/stars">
              <Button size="sm" variant="ghost" className="font-mono text-xs uppercase tracking-wider gap-1.5 h-7 text-primary hover:text-primary">
                <Sparkles className="w-3.5 h-3.5" /> Stars
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow label="Creator Name" value={profile.creatorName} />
            <InfoRow label="Full Name" value={profile.fullName} />
            <InfoRow label="Target Earnings" value={profile.targetMonthlyEarnings ? `$${profile.targetMonthlyEarnings}/mo` : undefined} />
            <InfoRow label="Min. Reward" value={profile.minimumReward ? `$${profile.minimumReward}` : undefined} />
            <InfoRow label="Weekly Capacity" value={profile.weeklyContentCapacity ? `${profile.weeklyContentCapacity} hrs` : undefined} />
            <InfoRow label="Member Since" value={user?.id ? "Joined" : undefined} />
          </div>
        </CardContent>
      </Card>

      {/* Creator Focus */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Creator Focus</p>
          <div className="flex flex-col gap-3">
            <ChipGroup label="Platforms" chips={platforms} icon={Globe} />
            <ChipGroup label="Niches" chips={niches} icon={Zap} />
            <ChipGroup label="Content Formats" chips={formats} icon={Gift} />
            <ChipGroup label="Bounty Types" chips={bountyTypes} icon={Target} />
          </div>
        </CardContent>
      </Card>

      {/* Self Assessment */}
      {(profile.creatorStrengths || profile.creatorWeaknesses) && (
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Self Assessment</p>
            <div className="flex flex-col gap-3">
              {profile.creatorStrengths && (
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Strengths</p>
                  <p className="font-mono text-sm text-foreground">{profile.creatorStrengths}</p>
                </div>
              )}
              {profile.creatorWeaknesses && (
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Weaknesses</p>
                  <p className="font-mono text-sm text-foreground">{profile.creatorWeaknesses}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio & Notes */}
      {(profile.portfolioLinks || profile.notes) && (
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col gap-4">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Portfolio & Notes</p>
            <div className="flex flex-col gap-3">
              {profile.portfolioLinks && (
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Portfolio</p>
                  <p className="font-mono text-sm text-foreground whitespace-pre-wrap">{profile.portfolioLinks}</p>
                </div>
              )}
              {profile.notes && (
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <p className="font-mono text-sm text-foreground whitespace-pre-wrap">{profile.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex flex-col items-center gap-1.5">
        <Icon className={`w-5 h-5 ${color}`} />
        <p className="font-mono text-lg font-bold text-foreground">{value}</p>
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-mono text-sm font-semibold text-foreground">{value || "Not set"}</p>
    </div>
  );
}

function ChipGroup({ label, chips, icon: Icon }: { label: string; chips: string[]; icon: React.ElementType }) {
  if (chips.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span key={chip} className="font-mono text-xs px-2 py-1 rounded-sm border border-primary/30 bg-primary/10 text-primary">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
