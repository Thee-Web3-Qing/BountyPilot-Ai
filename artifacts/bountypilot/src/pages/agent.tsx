import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, Cpu, Zap, ShieldCheck, ChevronRight, CheckCircle2, Circle,
  Loader2, RefreshCw, Brain, Crosshair, BookOpen, FileText,
  Link2, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { usePageMeta } from "@/lib/use-page-meta";
import { cn } from "@/lib/utils";

// ── Stream event types (mirror server) ───────────────────────────────────────

type StreamEvent =
  | { type: "scraping"; url: string }
  | { type: "scraped"; title: string; platform: string }
  | { type: "no_key" }
  | { type: "tool_call"; step: number; tool: string; label: string }
  | { type: "tool_result"; step: number; tool: string; durationMs: number; preview: string; score?: number }
  | { type: "done"; opportunityScore: number; scoreExplanation: string; briefGenerated: boolean; planGenerated: boolean; agentDecision: string; durationMs: number; title: string; platform: string }
  | { type: "error"; message: string }

// ── Tool metadata ─────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  score_bounty:            { icon: Crosshair,    color: "text-primary",    bg: "bg-primary/10 border-primary/30" },
  generate_research_brief: { icon: BookOpen,     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
  generate_production_plan:{ icon: FileText,     color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  finalize_pipeline:       { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
};

// ── Icon pill ─────────────────────────────────────────────────────────────────

function IconPill({
  icon: Icon, color, bg, spinning = false,
}: { icon: React.ElementType; color: string; bg: string; spinning?: boolean }) {
  return (
    <div className={cn("w-8 h-8 rounded border flex items-center justify-center flex-shrink-0", bg)}>
      <Icon className={cn("w-4 h-4", color, spinning && "animate-spin")} />
    </div>
  );
}

// ── Thinking action strip ─────────────────────────────────────────────────────

function ActionStrip({ events, running }: { events: StreamEvent[]; running: boolean }) {
  const toolCalls = events.filter((e): e is Extract<StreamEvent, { type: "tool_call" }> => e.type === "tool_call");
  const doneCount = events.filter((e) => e.type === "tool_result").length;
  const hasScraped = events.some((e) => e.type === "scraped");

  if (!hasScraped && toolCalls.length === 0 && !running) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {hasScraped && (
        <IconPill icon={Link2} color="text-muted-foreground" bg="bg-card border-border" />
      )}
      {toolCalls.map((tc) => {
        const isDone = events.some((e) => e.type === "tool_result" && (e as Extract<StreamEvent, { type: "tool_result" }>).step === tc.step);
        const meta = TOOL_META[tc.tool];
        if (!meta) return null;
        return isDone
          ? <IconPill key={tc.step} icon={meta.icon} color={meta.color} bg={meta.bg} />
          : <IconPill key={tc.step} icon={Loader2} color="text-muted-foreground" bg="bg-card border-border" spinning />;
      })}
      {running && (
        <div className="w-8 h-8 rounded border border-primary/40 bg-primary/5 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-primary animate-pulse" />
        </div>
      )}
      {doneCount > 0 && (
        <span className="font-mono text-xs text-muted-foreground ml-1">
          {doneCount} action{doneCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// ── Individual event row ──────────────────────────────────────────────────────

function EventRow({ event }: { event: StreamEvent }) {
  switch (event.type) {
    case "scraping":
      return (
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          Fetching bounty page…
        </div>
      );

    case "scraped":
      return (
        <div className="flex items-center gap-2 font-mono text-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <span className="text-foreground font-semibold truncate">{event.title}</span>
          <span className="text-muted-foreground text-xs flex-shrink-0">· {event.platform}</span>
        </div>
      );

    case "no_key":
      return (
        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Rule-based mode (no Qwen API key configured)
        </div>
      );

    case "tool_call": {
      const meta = TOOL_META[event.tool];
      const Icon = meta?.icon ?? Bot;
      return (
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Icon className={cn("w-3.5 h-3.5 flex-shrink-0 animate-pulse", meta?.color ?? "text-muted-foreground")} />
          {event.label}…
        </div>
      );
    }

    case "tool_result": {
      const meta = TOOL_META[event.tool];
      const Icon = meta?.icon ?? Bot;
      const secs = (event.durationMs / 1000).toFixed(1);
      return (
        <div className="flex flex-col gap-0.5 pl-0">
          <div className="flex items-center gap-2 font-mono text-xs">
            <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", meta?.color ?? "text-primary")} />
            <span className="text-foreground font-semibold">{TOOL_META[event.tool] ? event.tool.replace(/_/g, " ") : event.tool}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{secs}s</span>
            {event.score != null && (
              <span className={cn(
                "font-bold ml-1",
                event.score >= 7 ? "text-green-400" : event.score >= 5 ? "text-yellow-400" : "text-red-400"
              )}>
                {event.score}/10
              </span>
            )}
          </div>
          {event.preview && (
            <p className="font-mono text-xs text-muted-foreground pl-5 leading-relaxed line-clamp-2">
              {event.preview}
            </p>
          )}
        </div>
      );
    }

    case "done": {
      const secs = (event.durationMs / 1000).toFixed(1);
      return (
        <div className={cn(
          "rounded-sm border p-3 flex flex-col gap-1.5 mt-1",
          event.opportunityScore >= 7
            ? "border-green-500/40 bg-green-500/5"
            : event.opportunityScore >= 5
            ? "border-yellow-500/40 bg-yellow-500/5"
            : "border-red-500/40 bg-red-500/5"
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">Pipeline Complete</span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{secs}s total</span>
          </div>
          <div className="flex items-center gap-3 pl-6">
            <span className={cn(
              "font-bold text-2xl font-mono",
              event.opportunityScore >= 7 ? "text-green-400" : event.opportunityScore >= 5 ? "text-yellow-400" : "text-red-400"
            )}>
              {event.opportunityScore}/10
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Opportunity Score</span>
              <span className="font-mono text-xs text-muted-foreground">
                {event.briefGenerated ? "✓ Research brief" : "✗ No brief"}{" · "}
                {event.planGenerated ? "✓ Production plan" : "✗ No plan"}
              </span>
            </div>
          </div>
          {event.scoreExplanation && (
            <p className="font-mono text-xs text-muted-foreground pl-6 leading-relaxed">
              {event.scoreExplanation.slice(0, 180)}
            </p>
          )}
        </div>
      );
    }

    case "error":
      return (
        <div className="flex items-start gap-2 text-red-400 font-mono text-xs border border-red-500/30 bg-red-500/5 rounded-sm p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{event.message}</span>
        </div>
      );

    default:
      return null;
  }
}

// ── Live Agent Panel ──────────────────────────────────────────────────────────

function LiveAgentPanel({ token }: { token: string | null }) {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const isDone = events.some((e) => e.type === "done" || e.type === "error");

  const runAgent = async () => {
    if (!url.trim() || running || !token) return;
    setRunning(true);
    setEvents([]);

    try {
      const resp = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        setEvents([{ type: "error", message: err.error ?? "Request failed" }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const ev = JSON.parse(line.slice(6)) as StreamEvent;
              setEvents((prev) => [...prev, ev]);
            } catch {}
          }
        }
      }
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", message: (err as Error).message }]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="bg-card border-primary/20">
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Run Agent Live</p>
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runAgent(); }}
              disabled={running}
              placeholder="https://earn.superteam.fun/listing/..."
              className="w-full bg-background border border-border rounded-sm pl-9 pr-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
            />
          </div>
          <Button
            onClick={runAgent}
            disabled={running || !url.trim()}
            className="font-mono text-xs uppercase tracking-wider gap-1.5 flex-shrink-0"
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
              : <><Brain className="w-3.5 h-3.5" /> Run Agent</>
            }
          </Button>
          {isDone && !running && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEvents([]); setUrl(""); }}
              className="font-mono text-xs uppercase tracking-wider flex-shrink-0"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Live log */}
        {(events.length > 0 || running) && (
          <div className="border border-border rounded-sm bg-background/60 overflow-hidden">
            {/* Icon action strip header */}
            <div className="px-4 pt-3 pb-2 border-b border-border">
              <ActionStrip events={events} running={running} />
            </div>

            {/* Event log */}
            <div
              ref={logRef}
              className="px-4 py-3 flex flex-col gap-2.5 max-h-72 overflow-y-auto"
            >
              {events.map((ev, i) => <EventRow key={i} event={ev} />)}
              {running && events.length === 0 && (
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Connecting to agent…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hint when empty */}
        {events.length === 0 && !running && (
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            Paste any bounty URL — Superteam Earn, Devpost, Dework — and watch the Qwen agent score it,
            generate a research brief, and build a production plan in real time.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Existing page helpers ─────────────────────────────────────────────────────

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
  stats: { totalIndexed: number; highMatch: number; userHighMatch: number; recentCrawled: number };
  pipeline: PipelineStep[];
  recentActivity: ActivityItem[];
}

function scoreColor(s: number) {
  return s >= 7 ? "text-green-400" : s >= 5 ? "text-yellow-400" : "text-red-400";
}
function scoreBg(s: number) {
  return s >= 7 ? "border-green-500/40 bg-green-500/10" : s >= 5 ? "border-yellow-500/40 bg-yellow-500/10" : "border-red-500/40 bg-red-500/10";
}

const STEP_ICONS = [Bot, Cpu, Zap, ShieldCheck];
const STEP_COLORS = [
  "border-primary/40 bg-primary/5 text-primary",
  "border-blue-500/40 bg-blue-500/5 text-blue-400",
  "border-green-500/40 bg-green-500/5 text-green-400",
  "border-purple-500/40 bg-purple-500/5 text-purple-400",
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function Agent() {
  usePageMeta({ title: "Autopilot Agent", description: "Live Qwen AI agent pipeline", canonical: "/agent" });
  const { token } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading, refetch, isFetching } = useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => {
      const resp = await fetch("/api/agent/status", { headers: { Authorization: `Bearer ${token}` } });
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
          variant="outline" size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="font-mono text-xs uppercase tracking-wider flex-shrink-0"
        >
          {isFetching ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* ── LIVE AGENT PANEL ── */}
      <LiveAgentPanel token={token} />

      {/* Pipeline steps */}
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Agent Pipeline</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : data?.pipeline.map((step, i) => {
                const Icon = STEP_ICONS[i] ?? Bot;
                const [border, bg, text] = STEP_COLORS[i]?.split(" ") ?? ["border-border", "bg-card", "text-foreground"];
                return (
                  <div key={step.step} className={`border rounded-sm p-4 ${border} ${bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${text}`} />
                      <CheckCircle2 className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{step.label}</p>
                    <p className={`text-2xl font-bold font-mono mt-1 ${text}`}>{step.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-tight">{step.description}</p>
                  </div>
                );
              })}
        </div>
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
            { label: "AI Provider", value: data.aiProvider === "qwen" ? "Qwen" : "Rules", sub: data.aiProvider === "qwen" ? "tool-calling active" : "add QWEN_API_KEY" },
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
              No bounties indexed yet. Paste a URL above to run the agent.
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
                    <span className={`font-bold font-mono text-sm ${scoreColor(b.opportunityScore)}`}>{b.opportunityScore}</span>
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
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {b.opportunityScore != null && b.opportunityScore >= 7 && (
                    <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 uppercase tracking-wider">
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
              ["Score with Qwen AI", "Each bounty is evaluated by Qwen using native tool-calling — structured 1-10 score with breakdown: reward, deadline, format fit, and creator fit."],
              ["Match", "High-scoring bounties (7+/10) are surfaced as strong picks in your Discover feed and trigger notifications."],
              ["Human-in-the-Loop Checkpoint", "Before you commit to pursuing a bounty, the agent shows its full AI reasoning. You review it and confirm — only then is the action logged."],
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
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
            <a
              href="https://github.com/bountypilot/bountypilot/blob/main/ALIBABA_CLOUD.md"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              Powered by Alibaba Cloud · Qwen API (dashscope.aliyuncs.com)
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
