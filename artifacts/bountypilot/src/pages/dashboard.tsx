import { useState, useEffect, useCallback } from "react";
import { useGetDashboardSummary, useGetRecentBounties, useGetPlatformBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Activity, RefreshCw, Crown, Sparkles } from "lucide-react";
import { getListBountiesQueryKey, getGetDashboardSummaryQueryKey, getGetRecentBountiesQueryKey, getGetPlatformBreakdownQueryKey } from "@workspace/api-client-react";
import { API_BASE } from "@/lib/api";

interface CrawlerStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalAddedLastRun: number;
  totalCrawledBounties: number;
  lastResults: { platform: string; found: number; added: number }[];
}

function timeLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recent, isLoading: loadingRecent } = useGetRecentBounties();
  const { data: platformStats, isLoading: loadingPlatform } = useGetPlatformBreakdown();
  const { user, token, isPaid, isFree, planStatus } = useAuth();
  const queryClient = useQueryClient();
  const [crawlerStatus, setCrawlerStatus] = useState<CrawlerStatus | null>(null);
  const [triggeringCrawl, setTriggeringCrawl] = useState(false);
  const [, setTick] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/discover/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setCrawlerStatus(await resp.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 15000);
    // tick every 30s to re-render relative times
    const tick = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, [fetchStatus]);

  const triggerCrawl = async () => {
    if (!token) return;
    setTriggeringCrawl(true);
    try {
      await fetch(`${API_BASE}/discover/trigger`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimeout(fetchStatus, 2000);
    } finally {
      setTriggeringCrawl(false);
    }
  };

  const activePlatforms = crawlerStatus?.lastResults?.filter((r) => r.found > 0) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight text-foreground">Mission Control</h1>
          <p className="text-muted-foreground font-mono mt-2">Welcome back, <span className="text-foreground font-bold">@{user?.username}</span></p>
        </div>
        <div className="flex items-center gap-2">
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider bg-primary/10 border border-primary/30 text-primary px-2 py-1 rounded-sm">
              <Sparkles className="w-3 h-3" /> Premium
            </span>
          ) : (
            <Link href="/pricing">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-2 py-1 rounded-sm cursor-pointer hover:bg-yellow-500/20 transition-colors">
                <Crown className="w-3 h-3" /> {planStatus === "trial" ? "Trial" : "Free"} — Upgrade
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Crawler Status */}
      <Card className={`border ${crawlerStatus?.isRunning ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              {crawlerStatus?.isRunning ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <Activity className="w-4 h-4 text-primary" />
              )}
              Autonomous Crawler
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerCrawl}
              disabled={triggeringCrawl || crawlerStatus?.isRunning}
              className="h-7 font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${triggeringCrawl ? "animate-spin" : ""}`} />
              Run now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Status</p>
              <p className={`font-mono text-sm font-bold mt-1 ${crawlerStatus?.isRunning ? "text-primary" : "text-green-400"}`}>
                {crawlerStatus?.isRunning ? "● Crawling..." : "● Idle"}
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Last Run</p>
              <p className="font-mono text-sm font-bold mt-1">{timeAgo(crawlerStatus?.lastRunAt ?? null)}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Added Last Run</p>
              <p className={`font-mono text-sm font-bold mt-1 ${(crawlerStatus?.totalAddedLastRun ?? 0) > 0 ? "text-primary" : ""}`}>
                {crawlerStatus?.totalAddedLastRun ?? 0} new bounties
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Total Indexed</p>
              <p className="font-mono text-sm font-bold mt-1">{crawlerStatus?.totalCrawledBounties ?? 0}</p>
            </div>
          </div>
          {activePlatforms.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Live platforms last run</p>
              <div className="flex flex-wrap gap-2">
                {crawlerStatus?.lastResults?.map((r) => (
                  <span
                    key={r.platform}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-sm border ${r.found > 0 ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {r.platform} {r.found > 0 ? `· ${r.found}` : "· 0"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Earnings" value={summary?.totalEarnings ? `$${summary.totalEarnings}` : "$0"} loading={loadingSummary} highlight />
        <StatCard title="Pipeline Value" value={summary?.pipelineValue ? `$${summary.pipelineValue}` : "$0"} loading={loadingSummary} />
        <StatCard title="Active Bounties" value={summary?.activeBounties?.toString() || "0"} loading={loadingSummary} />
        <StatCard title="Avg Score" value={summary?.averageScore?.toFixed(1) || "0.0"} loading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Platform Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loadingPlatform ? (
              <Skeleton className="w-full h-full" />
            ) : platformStats && platformStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformStats}>
                  <XAxis dataKey="platform" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #333' }} />
                  <Bar dataKey="totalReward" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-mono text-sm">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Recent Bounties</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-4">
                <Skeleton className="w-full h-12" />
                <Skeleton className="w-full h-12" />
                <Skeleton className="w-full h-12" />
              </div>
            ) : recent && recent.length > 0 ? (
              <div className="space-y-4">
                {recent.slice(0, 5).map(bounty => (
                  <Link key={bounty.id} href={`/bounties/${bounty.id}`}>
                    <div className="group flex flex-col gap-1 p-3 rounded bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all cursor-pointer">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm truncate">{bounty.title || 'Untitled'}</span>
                        <span className="text-primary font-mono text-xs">{bounty.rewardAmount ? (bounty.rewardAmount.includes("-") ? bounty.rewardAmount : `$${bounty.rewardAmount}`) : ""} {bounty.rewardCurrency} {bounty.prizeRank ? bounty.prizeRank : ""}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                        <span>{bounty.platform || 'Unknown'}</span>
                        <span>{bounty.deadline ? timeLeft(bounty.deadline) || 'Open' : 'Open'}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground font-mono text-sm py-8">No recent bounties.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, loading, highlight = false }: { title: string, value: string, loading: boolean, highlight?: boolean }) {
  return (
    <Card className={`border ${highlight ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className={`text-3xl font-bold font-sans ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</div>}
      </CardContent>
    </Card>
  );
}
