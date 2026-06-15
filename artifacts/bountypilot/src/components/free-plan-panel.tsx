import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, Lock, Crown, Globe, ListTodo, Award, Coins, Gift, User, Zap, Brain, Plus, Sparkles } from "lucide-react";

export function FreePlanPanel() {
  const [, navigate] = useLocation();

  return (
    <div className="border border-border rounded-sm bg-card mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted border border-border rounded-sm flex items-center justify-center">
            <Crown className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-bold font-mono text-sm uppercase tracking-wider">Free Plan</p>
            <p className="font-mono text-[10px] text-muted-foreground">Your trial has ended — you now have limited access</p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/pricing")}
          className="font-mono text-xs uppercase tracking-wider shrink-0"
          size="sm"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Upgrade
        </Button>
      </div>

      {/* Two columns: what you have vs what's locked */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Free features */}
        <div className="px-5 py-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Still available for free</p>
          <ul className="space-y-2">
            {[
              { icon: Globe, label: "Browse discovered bounties" },
              { icon: ListTodo, label: "View your saved bounties" },
              { icon: Award, label: "View your submissions" },
              { icon: Coins, label: "View your earnings history" },
              { icon: Gift, label: "Referral program" },
              { icon: User, label: "Profile & settings" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Locked features */}
        <div className="px-5 py-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Unlock with a paid plan</p>
          <ul className="space-y-2">
            {[
              { icon: Brain, label: "AI bounty analysis & scoring" },
              { icon: Zap, label: "Research briefs" },
              { icon: Sparkles, label: "Production plans" },
              { icon: Plus, label: "Hunt & save new bounties" },
              { icon: Crown, label: "Unlimited bounties" },
              { icon: Sparkles, label: "All future AI features" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 font-mono text-xs text-muted-foreground/60">
                <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-4">
        <p className="font-mono text-xs text-muted-foreground">
          Plans from <span className="text-foreground font-bold">$5/mo</span> · Pay with any crypto
        </p>
        <button
          onClick={() => navigate("/pricing")}
          className="font-mono text-xs text-primary hover:underline underline-offset-2 shrink-0"
        >
          See all plans →
        </button>
      </div>
    </div>
  );
}
