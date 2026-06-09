import { useState } from "react";
import { useGetDashboardSummary, useGetRecentBounties, useGetPlatformBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap, Database } from "lucide-react";
import { getListBountiesQueryKey, getGetDashboardSummaryQueryKey, getGetRecentBountiesQueryKey, getGetPlatformBreakdownQueryKey } from "@workspace/api-client-react";

export function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: recent, isLoading: loadingRecent } = useGetRecentBounties();
  const { data: platformStats, isLoading: loadingPlatform } = useGetPlatformBreakdown();
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [llmMock, setLlmMock] = useState<boolean | null>(null);

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      const resp = await fetch("/api/demo/load", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setDemoLoaded(true);
        queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentBountiesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPlatformBreakdownQueryKey() });
      }
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight text-foreground">Mission Control</h1>
          <p className="text-muted-foreground font-mono mt-2">Welcome back, <span className="text-foreground font-bold">@{user?.username}</span></p>
        </div>
        {summary && summary.totalBounties === 0 && !demoLoaded && (
          <Button onClick={loadDemo} disabled={loadingDemo} variant="outline" className="font-mono text-xs uppercase tracking-wider border-primary/40 text-primary hover:bg-primary/10">
            {loadingDemo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
            Load Demo Data
          </Button>
        )}
        {demoLoaded && (
          <span className="font-mono text-xs text-green-400 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Demo data loaded
          </span>
        )}
      </div>

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
                        <span className="text-primary font-mono text-xs">{bounty.rewardAmount} {bounty.rewardCurrency}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                        <span>{bounty.platform || 'Unknown'}</span>
                        <span className="uppercase">{bounty.status.replace('_', ' ')}</span>
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
