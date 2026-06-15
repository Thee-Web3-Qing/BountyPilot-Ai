import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Clock, Coins, Users, ExternalLink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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

function timeLeft(deadline: string | null) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3600000);
  return `${hours}h left`;
}

function ApplyModal({ bounty, onClose, onSubmit }: { bounty: CustomBounty; onClose: () => void; onSubmit: (note: string, url: string) => Promise<void> }) {
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
              <AlertCircle className="w-4 h-4 shrink-0" />
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
    const newApp = await resp.json();
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
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-bold font-sans text-2xl uppercase tracking-tighter flex items-center gap-2">
          <Rocket className="w-6 h-6 text-primary" />
          Launchpad
        </h1>
        <p className="font-mono text-sm text-muted-foreground mt-1">
          Exclusive bounties posted by BountyPilot. Complete tasks, earn rewards.
        </p>
      </div>

      {/* Referral bounty CTA */}
      <div className="bg-primary/10 border border-primary/30 rounded-sm p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-bold font-mono text-sm uppercase tracking-wider text-primary">🎯 Active: Refer & Earn Campaign</p>
          <p className="font-mono text-xs text-muted-foreground mt-1">Refer 5+ creators to win $25 + 1 month free. $50 prize pool.</p>
        </div>
        <Button variant="outline" size="sm" className="font-mono shrink-0" onClick={() => window.location.href = "/referral"}>
          Join →
        </Button>
      </div>

      {/* Bounties list */}
      {bounties.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <Rocket className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm text-muted-foreground">No open bounties yet. Check back soon.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bounties.map((bounty) => {
            const appStatus = getAppStatus(bounty.id);
            const tl = timeLeft(bounty.deadline);
            return (
              <Card
                key={bounty.id}
                className={`bg-card border-border ${bounty.featured ? "border-primary/40" : ""}`}
              >
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
                    {tl && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {tl}
                      </span>
                    )}
                    {bounty.maxParticipants && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Max {bounty.maxParticipants}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {bounty.rewardType === "crypto" ? "Crypto payout" : "Access reward"}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    {success === bounty.id ? (
                      <div className="flex items-center gap-2 text-primary font-mono text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Application submitted!
                      </div>
                    ) : appStatus ? (
                      <Badge variant="outline" className="font-mono text-xs capitalize">
                        Applied — {appStatus.status}
                      </Badge>
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
