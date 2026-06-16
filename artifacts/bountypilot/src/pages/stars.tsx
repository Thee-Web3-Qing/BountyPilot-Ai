import { useState } from "react";
import { StarsDisplay } from "@/components/StarsDisplay";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { GamificationPanel } from "@/components/GamificationPanel";
import { usePageMeta } from "@/lib/use-page-meta";
import { Star, Trophy, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "stars" | "checkin" | "achievements";

export function Stars() {
  usePageMeta({ title: "Stars", description: "Your BountyPilot stars and achievements", canonical: "/stars" });
  const [activeTab, setActiveTab] = useState<TabKey>("stars");

  const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "stars", label: "Stars", icon: Star },
    { key: "checkin", label: "Check-in", icon: Calendar },
    { key: "achievements", label: "Achievements", icon: Trophy },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">Stars</h1>
          <p className="text-muted-foreground font-mono text-sm">Earn, redeem, and track your progress</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap",
                activeTab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "stars" && <StarsDisplay />}
      {activeTab === "checkin" && <DailyCheckIn />}
      {activeTab === "achievements" && <GamificationPanel />}
    </div>
  );
}
