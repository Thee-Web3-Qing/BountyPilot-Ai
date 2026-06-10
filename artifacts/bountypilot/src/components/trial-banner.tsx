import { Clock, Zap } from "lucide-react";
import { useAuth } from "@/contexts/auth";

export function TrialBanner() {
  const { planStatus, trialDaysLeft } = useAuth();

  if (planStatus === "beta") return null;
  if (planStatus !== "trial") return null;
  if (trialDaysLeft === null) return null;

  const urgent = trialDaysLeft <= 3;
  const warning = trialDaysLeft <= 7;

  return (
    <div className={`w-full px-4 py-2 text-xs font-medium flex items-center justify-between gap-2 ${
      urgent
        ? "bg-red-500/15 text-red-400 border-b border-red-500/20"
        : warning
        ? "bg-yellow-500/15 text-yellow-400 border-b border-yellow-500/20"
        : "bg-primary/10 text-primary border-b border-primary/20"
    }`}>
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          {trialDaysLeft === 0
            ? "Your trial expires today"
            : `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left on your free trial`}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-70">
        <Zap className="w-3 h-3" />
        <span>Full access active</span>
      </div>
    </div>
  );
}
