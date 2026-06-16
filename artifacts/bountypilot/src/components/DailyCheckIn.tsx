import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Star, Flame, Zap, Crown, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckinStatus {
  checkedInToday: boolean;
  streak: number;
  starsEarned: number;
  multiplier: number;
  bonusDaysLeft: number;
  isPaid: boolean;
  totalStars: number;
}

export function DailyCheckIn() {
  const { token } = useAuth();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadStatus();
  }, [token]);

  async function loadStatus() {
    try {
      const res = await fetch("/api/checkin/status", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) setStatus(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function handleCheckin() {
    if (!token || checkingIn || status?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setJustChecked(true);
        setStatus((prev) => prev ? {
          ...prev,
          checkedInToday: true,
          totalStars: data.newTotal,
          streak: data.streak,
          starsEarned: data.starsEarned,
          multiplier: data.multiplier,
        } : null);
        setTimeout(() => setJustChecked(false), 3000);
      }
    } catch {}
    finally { setCheckingIn(false); }
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().getDay();
  const week = days.map((d, i) => ({
    day: d,
    active: i === today,
    past: i < today,
    future: i > today,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Daily Check-In Card */}
      <Card className={cn(
        "bg-card border-border overflow-hidden",
        justChecked && "ring-2 ring-primary/40"
      )}>
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-sm bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">Daily Check-In</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {status.checkedInToday ? "Come back tomorrow!" : "Earn stars every day"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.isPaid && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-sm">
                  <Crown className="w-3 h-3" /> Pro
                </span>
              )}
              <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400" /> {status.totalStars}
              </span>
            </div>
          </div>

          {/* Week calendar strip */}
          <div className="flex items-center gap-1">
            {week.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 rounded-sm border transition-colors",
                  d.active
                    ? "border-primary/50 bg-primary/10"
                    : d.past
                    ? "border-border/50 bg-white/5"
                    : "border-border/30 bg-transparent"
                )}
              >
                <span className={cn(
                  "font-mono text-[10px] font-bold",
                  d.active ? "text-primary" : "text-muted-foreground"
                )}>
                  {d.day}
                </span>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center",
                  d.active && status.checkedInToday
                    ? "bg-green-500/20 border border-green-500/40"
                    : d.active
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-transparent"
                )}>
                  {d.active && status.checkedInToday && (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  )}
                  {d.active && !status.checkedInToday && (
                    <Star className="w-3 h-3 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Streak & multiplier */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-bold text-orange-400">{status.streak}</span>
              <span className="text-muted-foreground">day streak</span>
            </div>
            {status.multiplier > 1 && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-sm">
                <Zap className="w-3 h-3" /> {status.multiplier}x boost
              </span>
            )}
            {status.isPaid && status.bonusDaysLeft > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {status.bonusDaysLeft} boost days left
              </span>
            )}
          </div>

          {/* Check-in button */}
          <Button
            onClick={handleCheckin}
            disabled={status.checkedInToday || checkingIn}
            className={cn(
              "w-full font-mono text-xs font-bold uppercase tracking-wider h-11",
              status.checkedInToday
                ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {checkingIn ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : status.checkedInToday ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" /> Checked In Today
              </>
            ) : (
              <>
                <Star className="w-4 h-4 mr-2" /> Check In +{status.starsEarned} stars
              </>
            )}
          </Button>

          {justChecked && (
            <p className="font-mono text-xs text-green-400 text-center animate-pulse">
              +{status.starsEarned} stars earned! Total: {status.totalStars}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
