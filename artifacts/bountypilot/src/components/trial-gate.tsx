import { Lock, Clock, Sparkles, Crown } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";

function UpgradeCta({ compact = false }: { compact?: boolean }) {
  const [, navigate] = useLocation();
  if (compact) {
    return (
      <button
        onClick={() => navigate("/pricing")}
        className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 underline underline-offset-2"
      >
        <Crown className="w-3 h-3" /> Upgrade to unlock
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-6 gap-3">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Crown className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-1">Premium Feature</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Unlock AI scoring, research briefs, production plans, and unlimited bounties.
        </p>
      </div>
      <button
        onClick={() => navigate("/pricing")}
        className="text-xs font-mono bg-primary text-primary-foreground px-3 py-1.5 rounded-sm hover:bg-primary/90 transition-colors"
      >
        <Sparkles className="w-3 h-3 inline mr-1" /> View Plans
      </button>
    </div>
  );
}

export function TrialGate({ children }: { children: React.ReactNode }) {
  const { canAccessAI } = useAuth();
  if (canAccessAI) return <>{children}</>;
  return <UpgradeCta />;
}

export function AIFeatureGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canAccessAI } = useAuth();
  if (canAccessAI) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <div className="relative rounded-lg border border-border overflow-hidden">
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
        <Lock className="w-5 h-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
          Upgrade to unlock this feature
        </p>
        <UpgradeCta compact />
      </div>
    </div>
  );
}

export function FreeLimitGate({ children, limit, current, itemName = "items" }: {
  children: React.ReactNode;
  limit: number;
  current: number;
  itemName?: string;
}) {
  const { isPaid } = useAuth();
  if (isPaid) return <>{children}</>;
  if (current < limit) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-6 gap-3 border border-dashed border-border rounded-lg">
      <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <Lock className="w-6 h-6 text-yellow-500" />
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-1">Free limit reached</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          You have used {current} of {limit} {itemName} on the free plan. Upgrade for unlimited access.
        </p>
      </div>
      <UpgradeCta compact />
    </div>
  );
}
