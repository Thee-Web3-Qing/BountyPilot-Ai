import { Lock, Clock } from "lucide-react";
import { useAuth } from "@/contexts/auth";

export function TrialGate({ children }: { children: React.ReactNode }) {
  const { canAccessAI } = useAuth();

  if (canAccessAI) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-4">
      <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <Clock className="w-7 h-7 text-yellow-500" />
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">Access period has ended</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          AI features were available free until August 7th. Paid access is coming soon.
        </p>
      </div>
      <div className="text-xs text-muted-foreground/60 bg-muted/40 rounded px-3 py-1.5">
        Watch this space for updates.
      </div>
    </div>
  );
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
          Access period has ended
        </p>
      </div>
    </div>
  );
}
