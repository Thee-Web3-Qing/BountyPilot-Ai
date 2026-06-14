import { Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { Link } from "wouter";

const HACKATHON_DEADLINE = new Date("2026-08-07T20:00:00Z"); // Aug 7 10pm GMT+1
const GRACE_END = new Date(HACKATHON_DEADLINE.getTime() + 3 * 24 * 60 * 60 * 1000); // Aug 10

function formatTimeLeft(ms: number): string {
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function TrialBanner() {
  const { user } = useAuth();
  if (!user || user.plan === "beta" || user.plan === "active" || user.plan === "lifetime") return null;

  const now = new Date();
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const isHackathonUser = trialEndsAt && trialEndsAt.getTime() <= HACKATHON_DEADLINE.getTime() + 60_000;

  // ── Case 1: Hackathon period (before Aug 7) ──────────────────────────────
  if (isHackathonUser && now < HACKATHON_DEADLINE) {
    const ms = HACKATHON_DEADLINE.getTime() - now.getTime();
    const daysLeft = Math.floor(ms / (1000 * 60 * 60 * 24));
    const urgent = daysLeft < 3;
    const warning = daysLeft < 7;
    return (
      <div className={`w-full px-4 py-2 text-xs font-mono flex items-center justify-between gap-2 border-b ${
        urgent ? "bg-red-500/15 text-red-400 border-red-500/20"
        : warning ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
        : "bg-primary/10 text-primary border-primary/20"
      }`}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Free access open until Aug 7, 10pm GMT+1</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/pricing">
            <span className="inline-flex items-center gap-1 text-[10px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-2 py-0.5 rounded-sm cursor-pointer transition-colors">
              <Sparkles className="w-3 h-3" /> Upgrade
            </span>
          </Link>
          <span className="tabular-nums">{formatTimeLeft(ms)}</span>
        </div>
      </div>
    );
  }

  // ── Case 2: Grace period for existing users (Aug 7–10) ───────────────────
  if (isHackathonUser && now >= HACKATHON_DEADLINE && now < GRACE_END) {
    const ms = GRACE_END.getTime() - now.getTime();
    const daysLeft = Math.floor(ms / (1000 * 60 * 60 * 24));
    return (
      <div className={`w-full px-4 py-2 text-xs font-mono flex items-center justify-between gap-2 border-b ${
        daysLeft < 1 ? "bg-red-500/15 text-red-400 border-red-500/20"
        : "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
      }`}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Subscription launching soon — access ends Aug 10, 10pm GMT+1</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/pricing">
            <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-sm cursor-pointer transition-colors">
              <Sparkles className="w-3 h-3" /> Upgrade
            </span>
          </Link>
          <span className="tabular-nums">{formatTimeLeft(ms)}</span>
        </div>
      </div>
    );
  }

  // ── Case 3: Post-hackathon new user trial ─────────────────────────────────
  if (!isHackathonUser && trialEndsAt && now < trialEndsAt) {
    const ms = trialEndsAt.getTime() - now.getTime();
    const daysLeft = Math.floor(ms / (1000 * 60 * 60 * 24));
    const isLastDay = daysLeft === 0;
    return (
      <div className={`w-full px-4 py-2 text-xs font-mono flex items-center justify-between gap-2 border-b ${
        isLastDay ? "bg-red-500/15 text-red-400 border-red-500/20"
        : daysLeft < 3 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20"
        : "bg-primary/10 text-primary border-primary/20"
      }`}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {isLastDay
              ? "Your trial ends today — subscription coming soon"
              : `Free trial — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/pricing">
            <span className="inline-flex items-center gap-1 text-[10px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-2 py-0.5 rounded-sm cursor-pointer transition-colors">
              <Sparkles className="w-3 h-3" /> Upgrade
            </span>
          </Link>
          <span className="tabular-nums">{formatTimeLeft(ms)}</span>
        </div>
      </div>
    );
  }

  // ── Case 4: Expired ───────────────────────────────────────────────────────
  return (
    <div className="w-full px-4 py-2 text-xs font-mono flex items-center justify-between gap-2 bg-red-500/15 text-red-400 border-b border-red-500/20">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Your access has ended — upgrade to continue</span>
      </div>
      <Link href="/pricing">
        <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-sm cursor-pointer transition-colors">
          <Sparkles className="w-3 h-3" /> Upgrade
        </span>
      </Link>
    </div>
  );
}
