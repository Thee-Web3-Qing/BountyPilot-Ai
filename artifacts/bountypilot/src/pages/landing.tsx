import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/use-page-meta";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Crosshair,
  Sparkles,
  Search,
  FileText,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Zap,
  DollarSign,
  Check,
  Crown,
  Code2,
  Palette,
  Users,
  GraduationCap,
  Megaphone,
} from "lucide-react";

export function Landing() {
  const [, navigate] = useLocation();

  usePageMeta({
    title: "BountyPilot AI — Find Paid Opportunities Online",
    description:
      "BountyPilot AI helps creators, developers, designers, marketers, and students discover paid bounties and opportunities across Web3 platforms. AI-powered scoring, research briefs, and production plans — all in one place.",
    canonical: "https://bountypilot.xyz/",
    ogUrl: "https://bountypilot.xyz/",
  });

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
          <NotificationBell />
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
          Get Paid For<br />
          What You're<br />
          <span className="text-primary">Already Good At</span>
        </h1>

        <p className="text-muted-foreground font-mono text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-4">
          Whether you're a creator, developer, designer, marketer, student, or just someone looking for more opportunities online — BountyPilot finds paid bounties that match your skills, scores them with AI, and builds your action plan so you can go straight to earning.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {[
            { icon: <Sparkles className="w-3 h-3" />, label: "Creators" },
            { icon: <Code2 className="w-3 h-3" />, label: "Developers" },
            { icon: <Palette className="w-3 h-3" />, label: "Designers" },
            { icon: <Megaphone className="w-3 h-3" />, label: "Marketers" },
            { icon: <Users className="w-3 h-3" />, label: "Community Builders" },
            { icon: <GraduationCap className="w-3 h-3" />, label: "Students" },
          ].map(({ icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground border border-border px-2.5 py-1 rounded-full">
              {icon} {label}
            </span>
          ))}
        </div>

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
              <p className="font-sans font-bold text-lg">Action Plans</p>
              <p className="font-mono text-sm text-muted-foreground">Unlimited</p>
            </div>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-3 text-center">
            After Aug 7, free plan gets 3 bounties + 50 browse limit. Upgrade to unlock everything.
          </p>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-border px-6 py-16 bg-card">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground text-center mb-10">
            Built for everyone with something to offer
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <Sparkles className="w-5 h-5 text-primary" />,
                title: "Creators",
                desc: "Writers, video makers, podcasters, thread writers — find content bounties across Web3 platforms.",
              },
              {
                icon: <Code2 className="w-5 h-5 text-primary" />,
                title: "Developers",
                desc: "Coders and builders — discover hackathons, technical bounties, and open-source grants.",
              },
              {
                icon: <Palette className="w-5 h-5 text-primary" />,
                title: "Designers",
                desc: "UI/UX, graphic, and motion designers — land paid design bounties from Web3 projects.",
              },
              {
                icon: <Megaphone className="w-5 h-5 text-primary" />,
                title: "Marketers",
                desc: "Growth, SEO, and social experts — projects need you to help them grow their communities.",
              },
              {
                icon: <Users className="w-5 h-5 text-primary" />,
                title: "Community Builders",
                desc: "Discord mods, ambassadors, advocates — earn for building and managing online communities.",
              },
              {
                icon: <GraduationCap className="w-5 h-5 text-primary" />,
                title: "Students",
                desc: "Learn by doing and earn at the same time — bounties are a great way to build your portfolio.",
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-2 p-4 border border-border rounded-lg bg-background">
                <div className="mb-1">{icon}</div>
                <p className="font-sans font-bold uppercase tracking-tight text-sm">{title}</p>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
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
                desc: "Auto-crawls Superteam, Zealy, Galxe, Devpost, and 15+ platforms for live paid opportunities.",
              },
              {
                icon: <Sparkles className="w-5 h-5" />,
                step: "02",
                title: "AI Match",
                desc: "Each opportunity gets a personalised 1–10 match score based on your skills, niche, and goals.",
              },
              {
                icon: <FileText className="w-5 h-5" />,
                step: "03",
                title: "Research Brief",
                desc: "One click generates a full brief: key angles, talking points, audience context, and analysis.",
              },
              {
                icon: <ClipboardList className="w-5 h-5" />,
                step: "04",
                title: "Action Plan",
                desc: "AI builds your step-by-step execution plan — whatever your medium, you know exactly what to do.",
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
                title: "Matched to You",
                desc: "Tell us your skills, platforms, and goals once — every score and brief is personalised to your profile.",
              },
              {
                icon: <DollarSign className="w-5 h-5 text-primary" />,
                title: "Track Every Dollar",
                desc: "Log submissions, track payouts, and see your total earnings across all bounty platforms in one view.",
              },
              {
                icon: <TrendingUp className="w-5 h-5 text-primary" />,
                title: "Stay Organised",
                desc: "Move opportunities through your pipeline — Discovered → Approved → In Progress → Submitted.",
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
              { feature: "Browse Opportunities", desc: "Unlimited across all platforms" },
              { feature: "Pipeline Tracker", desc: "Manage unlimited opportunities" },
              { feature: "AI Match Score", desc: "Personalised 1-10 score with full breakdown" },
              { feature: "For You Matching", desc: "Skill-based smart filter" },
              { feature: "Research Brief", desc: "AI-generated angles and talking points" },
              { feature: "Action Plan", desc: "AI-generated step-by-step execution plan" },
              { feature: "Dashboard Analytics", desc: "Full earnings and platform breakdown" },
              { feature: "Hackathon Crawler", desc: "Auto-discovers open hackathons and grants" },
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
            Whatever you do online,<br />there's a bounty for it.
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
          © 2025 BountyPilot AI — Paid opportunities for everyone online
        </p>
      </footer>
    </div>
  );
}
