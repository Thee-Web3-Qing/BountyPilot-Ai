import { useState, useEffect } from "react";
import { Crosshair, Users, Zap, Clock, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export function Waitlist() {
  const [form, setForm] = useState({ email: "", name: "", why: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<{ spotsLeft: number; waitlistCount: number } | null>(null);

  useEffect(() => {
    fetch("/api/waitlist/stats")
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.error === "already_on_waitlist") {
          setError("You're already on the waitlist! We'll be in touch soon.");
        } else if (data.error === "waitlist_full") {
          setError("The waitlist is currently full. Follow @BountyPilot for updates.");
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }
      setSuccess(true);
      setPosition(data.position);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">You're on the list</h1>
            {position && (
              <p className="text-4xl font-mono font-bold text-primary mb-3">#{position}</p>
            )}
            <p className="text-muted-foreground text-sm leading-relaxed">
              We're opening access in small batches. Once approved, you'll get <strong>14 days of full access</strong> — AI research briefs, production plans, and opportunity scoring.
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-left space-y-2">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">What happens next</p>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>✓ You'll get an email when approved</p>
              <p>✓ Sign up for your account at that point</p>
              <p>✓ 14-day trial starts immediately on approval</p>
            </div>
          </div>
          <Link href="/">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">← Back to home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-14 flex items-center border-b border-border">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
              <Crosshair className="w-4 h-4" />
            </div>
            <span className="font-bold font-sans text-base uppercase tracking-tighter">BountyPilot</span>
          </div>
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-mono px-3 py-1.5 rounded-full border border-primary/20">
              <Users className="w-3.5 h-3.5" />
              {stats ? `${stats.spotsLeft} spots remaining` : "Limited early access"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Join the waitlist</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              BountyPilot is in private beta. Get early access to AI-powered bounty discovery, research briefs, and production planning for Web3 creators.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Zap, label: "AI scoring", desc: "Every bounty ranked" },
              { icon: Clock, label: "14-day trial", desc: "Full access free" },
              { icon: Users, label: "1000 cap", desc: "Beta limit" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-3 space-y-1">
                <Icon className="w-4 h-4 text-primary mx-auto" />
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">Name <span className="normal-case text-muted-foreground/50">(optional)</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your name or handle"
                className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-1.5">What do you create? <span className="normal-case text-muted-foreground/50">(optional)</span></label>
              <textarea
                value={form.why}
                onChange={e => setForm(f => ({ ...f, why: e.target.value }))}
                placeholder="e.g. YouTube videos about DeFi, Twitter threads on Solana…"
                rows={2}
                className="w-full bg-card border border-border rounded px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded text-sm uppercase tracking-wider font-mono hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Joining…" : "Request Early Access"}
            </button>

            <p className="text-center text-xs text-muted-foreground/60">
              Already have an account?{" "}
              <Link href="/login"><span className="text-primary hover:underline cursor-pointer">Sign in</span></Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
