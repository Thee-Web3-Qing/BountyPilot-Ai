import { useAuth } from "@/contexts/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Cpu, Zap, ShieldCheck, ChevronRight, CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

interface PipelineStep {
  step: string;
  label: string;
  description: string;
  count: number;
}

interface ActivityItem {
  id: number;
  title: string | null;
  platform: string | null;
  opportunityScore: number | null;
  scoreExplanation: string | null;
  status: string;
  createdAt: string;
  rewardAmount: string | null;
  rewardCurrency: string | null;
}

interface AgentStatus {
  aiProvider: "qwen" | "rule-based";
  stats: {
    totalIndexed: number;
    highMatch: number;
    userHighMatch: number;
    recentCrawled: number;
  };
  pipeline: PipelineStep[];
  recentActivity: ActivityItem[];
}

function scoreColor(score: number) {
  if (score >= 7) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  return "text-red-400";
}
function scoreBg(score: number) {
  if (score >= 7) return "border-green-500/40 bg-green-500/10";
  if (score >= 5) return "border-yellow-500/40 bg-yellow-500/10";
  return "border-red-500/40 bg-red-500/10";
}

const STEP_ICONS = [Bot, Cpu, Zap, ShieldCheck];
const STEP_COLORS = [
  "border-primary/40 bg-primary/5 text-primary",
  "border-blue-500/40 bg-blue-500/5 text-blue-400",
  "border-green-500/40 bg-green-500/5 text-green-400",
  "border-purple-500/40 bg-purple-500/5 text-purple-400",
];

export function Agent() {
  const { token } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading, refetch, isFetching } = useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => {
      const resp = await fetch("/api/agent/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to fetch agent status");
      return resp.json();
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Autopilot Agent
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            {data?.aiProvider === "qwen"
              ? "Powered by Qwen AI · native tool-calling pipeline"
              : "Rule-based scoring · configure QWEN_API_KEY to enable AI"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="font-mono text-xs uppercase tracking-wider flex-shrink-0"
        >
          {isFetching
            ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
            : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Pipeline steps */}
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Agent Pipeline</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : data?.pipeline.map((step, i) => {
                const Icon = STEP_ICONS[i] ?? Bot;
                const colorClass = STEP_COLORS[i] ?? STEP_COLORS[0];
                const [borderBg, , textClass] = colorClass.split(" ");
                return (
                  <div key={step.step} className={`border rounded-sm p-4 ${borderBg} ${STEP_COLORS[i].split(" ")[1]}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${STEP_COLORS[i].split(" ")[2]}`} />
                      <CheckCircle2 className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{step.label}</p>
                    <p className={`text-2xl font-bold font-mono mt-1 ${STEP_COLORS[i].split(" ")[2]}`}>
                      {step.count.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{step.description}</p>
                  </div>
                );
              })}
        </div>
        {/* Connector arrows (desktop) */}
        <div className="hidden md:flex items-center justify-center gap-0 mt-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 flex items-center justify-center">
              <div className="h-px flex-1 bg-border" />
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
              <div className="h-px flex-1 bg-border" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Indexed", value: data.stats.totalIndexed.toLocaleString(), sub: "bounties in DB" },
            { label: "High Match (Global)", value: data.stats.highMatch.toLocaleString(), sub: "score 7+ / 10" },
            { label: "Discovered (24h)", value: data.stats.recentCrawled.toLocaleString(), sub: "newly indexed" },
            {
              label: "AI Provider",
              value: data.aiProvider === "qwen" ? "Qwen" : "Rules",
              sub: data.aiProvider === "qwen" ? "tool-calling active" : "add QWEN_API_KEY",
            },
          ].map((s) => (
            <Card key={s.label} className="bg-card border-border">
              <CardContent className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold font-mono mt-1">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Activity Feed */}
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Recent Activity Feed</p>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : !data?.recentActivity.length ? (
          <div className="border border-border rounded-sm p-10 text-center">
            <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground">
              No bounties indexed yet. Add a bounty to start the pipeline.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.recentActivity.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/bounties/${b.id}`)}
                className="flex items-center gap-3 p-3 bg-card border border-border hover:border-primary/40 active:border-primary/60 rounded-sm text-left transition-colors w-full"
              >
                {b.opportunityScore != null ? (
                  <div className={`w-10 h-10 rounded-sm border flex items-center justify-center flex-shrink-0 ${scoreBg(b.opportunityScore)}`}>
                    <span className={`font-bold font-mono text-sm ${scoreColor(b.opportunityScore)}`}>
                      {b.opportunityScore}
                    </span>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-sm border border-border flex items-center justify-center flex-shrink-0">
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {b.platform} · {b.status.replace(/_/g, " ")} · {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {b.opportunityScore != null && b.opportunityScore >= 7 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 uppercase tracking-wider">
                      High Match
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <Card className="bg-card border-primary/20">
        <CardContent className="p-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">How the Autopilot works</p>
          <ol className="space-y-2.5 text-sm">
            {[
              ["Discover", "The agent crawls Web3 bounty platforms (Superteam Earn, Devpost, Dework, etc.) for new opportunities continuously."],
              ["Score with Qwen AI", "Each bounty is evaluated by Qwen using native tool-calling — it outputs a structured 1-10 score with breakdown: reward, deadline, format fit, and creator fit."],
              ["Match", "High-scoring bounties (7+/10) are surfaced as strong picks in your Discover feed and trigger notifications."],
              ["Human-in-the-Loop Checkpoint", "Before you commit to pursuing a bounty, the agent shows its full AI reasoning. You review it and confirm — only then is the action logged. Humans stay in control."],
            ].map(([title, desc], i) => (
              <li key={i} className="flex gap-3">
                <span className="font-mono text-primary font-bold text-xs mt-0.5 w-5 flex-shrink-0">{i + 1}.</span>
                <div>
                  <span className="font-medium">{title}</span>
                  <span className="text-muted-foreground"> — {desc}</span>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
