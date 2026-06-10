import { Clock } from "lucide-react";
import { useAuth } from "@/contexts/auth";

const DEADLINE = new Date("2026-08-07T20:00:00Z"); // Aug 7 10pm GMT+1

export function TrialBanner() {
  const { user } = useAuth();
  if (!user) return null;

  const now = new Date();
  const msLeft = DEADLINE.getTime() - now.getTime();

  if (msLeft <= 0) {
    return (
      <div className="w-full px-4 py-2 text-xs font-mono flex items-center gap-2 bg-red-500/15 text-red-400 border-b border-red-500/20">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Hackathon access period has ended</span>
      </div>
    );
  }

  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const urgent = daysLeft < 3;
  const warning = daysLeft < 7;

  const timeStr = daysLeft > 0
    ? `${daysLeft}d ${hoursLeft}h remaining`
    : `${hoursLeft}h remaining`;

  return (
    <div className={`w-full px-4 py-2 text-xs font-mono flex items-center justify-between gap-2 ${
      urgent
        ? "bg-red-500/15 text-red-400 border-b border-red-500/20"
        : warning
        ? "bg-yellow-500/15 text-yellow-400 border-b border-yellow-500/20"
        : "bg-primary/10 text-primary border-b border-primary/20"
    }`}>
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Free access open until Aug 7, 10pm GMT+1</span>
      </div>
      <span className="shrink-0 opacity-80">{timeStr}</span>
    </div>
  );
}
