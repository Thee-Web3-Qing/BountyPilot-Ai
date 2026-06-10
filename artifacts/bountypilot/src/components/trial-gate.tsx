import { Lock, Clock, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth";

export function TrialGate({ children }: { children: React.ReactNode }) {
  const { planStatus, canAccessAI } = useAuth();

  if (canAccessAI) return <>{children}</>;

  if (planStatus === "pending") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base mb-1">You're on the waitlist</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            We're reviewing applications and opening access in batches. You'll get 14 days of full access once approved.
          </p>
        </div>
        <div className="text-xs text-muted-foreground/60 bg-muted/40 rounded px-3 py-1.5">
          No action needed — we'll notify you by email.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-4">
      <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <Clock className="w-7 h-7 text-yellow-500" />
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">Your trial has ended</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          AI features — research briefs, production plans, and opportunity scoring — are available on paid plans.
        </p>
      </div>
      <div className="text-xs text-muted-foreground/60 bg-muted/40 rounded px-3 py-1.5">
        Paid access coming soon. Watch this space.
      </div>
    </div>
  );
}

export function AIFeatureGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canAccessAI, planStatus } = useAuth();
  if (canAccessAI) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative rounded-lg border border-border overflow-hidden">
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
        <Lock className="w-5 h-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
          {planStatus === "pending" ? "Awaiting waitlist approval" : "Upgrade to unlock AI features"}
        </p>
      </div>
    </div>
  );
}
