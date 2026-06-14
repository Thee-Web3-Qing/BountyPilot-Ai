import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Crosshair,
  Sparkles,
  Search,
  FileText,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Zap,
  Target,
  DollarSign,
  Check,
  X,
  Crown,
  Lock,
} from "lucide-react";

export function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Beta Banner */}
      <div className="bg-primary text-primary-foreground text-center py-2 px-4">
        <p className="font-mono text-sm">
          Free access open until Aug 7, 10pm GMT+1 — all features are unlocked. Happy hunting!
        </p>
      </div>

      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
            <Crosshair className="w-5 h-5" />
          </div>
          <span className="font-bold font-sans text-lg uppercase tracking-tighter">BountyPilot AI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </button>
          <Button
            size="sm"
            onClick={() => navigate("/signup")}
            className="font-mono text-xs uppercase tracking-wider"
          >
            Create Account
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 rounded-full px-3 py-1 mb-8">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary uppercase tracking-wider">Powered by AI</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-sans uppercase tracking-tighter leading-none mb-6">
          Turn Crypto<br />
          <span className="text-primary">Bounties</span> Into<br />
          Creator Income
        </h1>

        <p className="text-muted-foreground font-mono text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-10">
          BountyPilot finds paid content opportunities across Web3 platforms, scores them with AI, then builds your research brief and production plan — so you just show up and create.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            size="lg"
            onClick={() => navigate("/signup")}
            className="font-mono uppercase tracking-wider text-sm w-full sm:w-auto"
          >
            Start for Free <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <button
            onClick={() => navigate("/login")}
            className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Already have an account? Sign In →
          </button>
        </div>

        <div className="mt-6 border border-border rounded-lg p-4 bg-card/50 max-w-md w-full">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Free During Beta</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-sans font-bold text-lg">AI Scoring</p>
              <p className="font-mono text-sm text-muted-foreground">Unlimited</p>
            </div>
            <div className="flex-1">
              <p className="font-sans font-bold text-lg">Research Briefs</p>
              <p className="font-mono text-sm text-muted-foreground">Unlimited</p>
            </div>
            <div className="flex-1">
              <p className="font-sans font-bold text-lg">Production Plans</p>
              <p className="font-mono text-sm text-muted-foreground">Unlimited</p>
            </div>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-3 text-center">
            After Aug 7, free plan gets 3 bounties + 50 browse limit. Upgrade to unlock everything.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center mb-10">
            How It Works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Search className="w-5 h-5" />,
                step: "01",
                title: "Discover",
                desc: "Auto-crawls Superteam, Zealy, Galxe, and 15+ platforms for live paid bounties.",
              },
              {
                icon: <Target className="w-5 h-5" />,
                step: "02",
                title: "AI Score",
                desc: "Each bounty gets a personalised 1–10 score based on your niche, formats, and skill level.",
              },
              {
                icon: <FileText className="w-5 h-5" />,
                step: "03",
                title: "Research Brief",
                desc: "One click generates a full brief: content angles, key points, audience, and competitor analysis.",
              },
              {
                icon: <ClipboardList className="w-5 h-5" />,
                step: "04",
                title: "Production Plan",
                desc: "AI writes your script outline, shot list, caption draft, and submission checklist.",
              },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 border border-primary/40 bg-primary/5 rounded-sm flex items-center justify-center text-primary flex-shrink-0">
                    {icon}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{step}</span>
                </div>
                <div>
                  <p className="font-sans font-bold uppercase tracking-tight text-sm mb-1">{title}</p>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features strip */}
      <section className="border-t border-border bg-card px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-5 h-5 text-primary" />,
                title: "Built for Creators",
                desc: "Set your platforms, content formats, and niche once — every score and brief is personalised to you.",
              },
              {
                icon: <DollarSign className="w-5 h-5 text-primary" />,
                title: "Track Every Dollar",
                desc: "Log submissions, track payouts, and see your total earnings across all bounty platforms in one view.",
              },
              {
                icon: <TrendingUp className="w-5 h-5 text-primary" />,
                title: "Stay Organised",
                desc: "Move bounties through your workflow — Discovered → Approved → Scripting → Submitted — all in one place.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-2">
                <div className="mb-1">{icon}</div>
                <p className="font-sans font-bold uppercase tracking-tight text-sm">{title}</p>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center mb-8">
            All Features Included
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { feature: "Browse Bounties", desc: "Unlimited across all platforms" },
              { feature: "Pipeline Bounties", desc: "Track unlimited opportunities" },
              { feature: "AI Opportunity Score", desc: "Full 1-10 score with breakdown" },
              { feature: "For You Matching", desc: "Profile-based smart filter" },
              { feature: "Research Brief", desc: "AI-generated content angles" },
              { feature: "Production Plan", desc: "AI-generated script outlines" },
              { feature: "Dashboard Analytics", desc: "Full platform breakdown" },
              { feature: "Devpost Crawler", desc: "Auto-discovers open hackathons" },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 p-4 border border-border rounded-lg">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <p className="font-mono text-xs text-foreground">{row.feature}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button size="sm" onClick={() => navigate("/signup")} className="font-mono text-xs uppercase">
              Get Started <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="border-t border-border px-6 py-16 text-center">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-6">
          <h2 className="font-bold font-sans text-3xl uppercase tracking-tighter">
            Ready to start<br />earning from bounties?
          </h2>
          <p className="font-mono text-sm text-muted-foreground">
            Free during beta. No credit card required. Upgrade anytime for unlimited access.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/signup")}
            className="font-mono uppercase tracking-wider text-sm"
          >
            Start for Free <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-5 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          © 2025 BountyPilot AI — Your creator revenue autopilot
        </p>
      </footer>
    </div>
  );
}
