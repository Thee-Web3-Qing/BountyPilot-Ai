import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, RefreshCw, Globe, Plus, CheckCircle, AlertCircle,
  Clock, Search, Zap, ChevronRight, Shield,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListBountiesQueryKey } from "@workspace/api-client-react";

interface DiscoveredBounty {
  id: number;
  url: string;
  title: string | null;
  platform: string | null;
  projectName: string | null;
  rewardAmount: string | null;
  rewardCurrency: string | null;
  deadline: string | null;
  contentFormat: string | null;
  opportunityScore: number | null;
  scoreExplanation: string | null;
  confidenceScore: number | null;
  status: string;
  createdAt: string;
}

interface CrawlerStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResults: { platform: string; added: number; skipped: number; error?: string; durationMs: number }[];
  totalAddedLastRun: number;
  totalCrawledBounties: number;
}

const SCORE_COLOR = (score: number) => {
  if (score >= 7) return "text-green-400 border-green-400/40 bg-green-400/10";
  if (score >= 4) return "text-yellow-400 border-yellow-400/40 bg-yellow-400/10";
  return "text-red-400 border-red-400/40 bg-red-400/10";
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Discover() {
  const [bounties, setBounties] = useState<DiscoveredBounty[]>([]);
  const [crawlerStatus, setCrawlerStatus] = useState<CrawlerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<Set<number>>(new Set());
  const [triggering, setTriggering] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const token = localStorage.getItem("bountypilot_token");

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/discover", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/discover/status", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bRes.ok) setBounties(await bRes.json());
      if (sRes.ok) setCrawlerStatus(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleClaim = async (bountyId: number) => {
    setClaiming(bountyId);
    try {
      const resp = await fetch(`/api/discover/${bountyId}/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setClaimed((prev) => new Set([...prev, bountyId]));
        queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
        setTimeout(() => navigate(`/bounties/${data.id}`), 800);
      } else if (resp.status === 409) {
        const data = await resp.json();
        navigate(`/bounties/${data.bountyId}`);
      }
    } finally {
      setClaiming(null);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await fetch("/api/discover/trigger", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setTimeout(fetchData, 2000);
    } finally {
      setTimeout(() => setTriggering(false), 3000);
    }
  };

  const platforms = [...new Set(bounties.map((b) => b.platform).filter(Boolean))] as string[];
  const filtered = bounties.filter((b) => {
    if (filterPlatform && b.platform !== filterPlatform) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.title?.toLowerCase().includes(q) ||
        b.platform?.toLowerCase().includes(q) ||
        b.projectName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Discover</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Auto-fetched bounties from 20 platforms · Updated hourly
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleTrigger}
            disabled={triggering || crawlerStatus?.isRunning}
            variant="outline"
            size="sm"
            className="font-mono text-xs uppercase tracking-wider"
          >
            {triggering || crawlerStatus?.isRunning
              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            {crawlerStatus?.isRunning ? "Crawling..." : "Refresh Now"}
          </Button>
          <Button onClick={fetchData} variant="ghost" size="sm" className="font-mono text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Crawler status bar */}
      {crawlerStatus && (
        <div className={`flex flex-wrap items-center gap-4 px-4 py-3 rounded-sm border font-mono text-xs ${crawlerStatus.isRunning ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2">
            {crawlerStatus.isRunning
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              : <Globe className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className={crawlerStatus.isRunning ? "text-primary font-bold" : "text-muted-foreground"}>
              {crawlerStatus.isRunning ? "Crawling platforms..." : "Crawler idle"}
            </span>
          </div>
          {crawlerStatus.lastRunAt && (
            <span className="text-muted-foreground">
              Last run: <span className="text-foreground">{timeAgo(crawlerStatus.lastRunAt)}</span>
            </span>
          )}
          <span className="text-muted-foreground">
            Pool: <span className="text-foreground font-bold">{crawlerStatus.totalCrawledBounties}</span> bounties
          </span>
          {crawlerStatus.totalAddedLastRun > 0 && (
            <span className="text-green-400">
              +{crawlerStatus.totalAddedLastRun} last run
            </span>
          )}
          <span className="text-muted-foreground ml-auto">
            Next: <span className="text-foreground">top of hour</span>
          </span>
        </div>
      )}

      {/* Last crawl results */}
      {crawlerStatus?.lastResults && crawlerStatus.lastResults.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Last Crawl — Per Platform</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {crawlerStatus.lastResults.map((r) => (
                <div key={r.platform} className={`flex items-center gap-2 px-3 py-2 rounded-sm border text-xs font-mono ${r.error ? "border-red-500/20 bg-red-500/5" : r.added > 0 ? "border-green-500/20 bg-green-500/5" : "border-border"}`}>
                  {r.error
                    ? <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    : r.added > 0
                    ? <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                    : <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                  <span className="truncate text-foreground">{r.platform}</span>
                  {r.added > 0 && <span className="text-green-400 ml-auto">+{r.added}</span>}
                  {r.error && <span className="text-red-400 ml-auto">err</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bounties..."
            className="pl-9 font-mono text-sm bg-background"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterPlatform("")}
            className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors ${!filterPlatform ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {platforms.slice(0, 8).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPlatform(filterPlatform === p ? "" : p)}
              className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors ${filterPlatform === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Bounties list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground font-mono gap-3">
          <Loader2 className="w-6 h-6 animate-spin" /> Loading discover pool...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Globe className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <p className="font-mono text-sm text-muted-foreground">No bounties in pool yet</p>
            <p className="font-mono text-xs text-muted-foreground/60 mt-1">
              {crawlerStatus?.isRunning ? "Crawl is running — check back shortly" : "Click \"Refresh Now\" to trigger a crawl"}
            </p>
          </div>
          {!crawlerStatus?.isRunning && (
            <Button onClick={handleTrigger} disabled={triggering} variant="outline" className="font-mono text-xs uppercase">
              <Zap className="w-4 h-4 mr-2" /> Trigger Crawl
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-muted-foreground">{filtered.length} bounties found</p>
          {filtered.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              isClaiming={claiming === bounty.id}
              isClaimed={claimed.has(bounty.id)}
              onClaim={() => handleClaim(bounty.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BountyCard({
  bounty, isClaiming, isClaimed, onClaim,
}: {
  bounty: DiscoveredBounty;
  isClaiming: boolean;
  isClaimed: boolean;
  onClaim: () => void;
}) {
  const score = bounty.opportunityScore ?? 0;
  const daysLeft = bounty.deadline
    ? Math.round((new Date(bounty.deadline).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{bounty.platform || "Unknown"}</span>
              {bounty.projectName && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-xs text-muted-foreground">{bounty.projectName}</span>
                </>
              )}
              <span className="text-muted-foreground/40 ml-auto">·</span>
              <span className="font-mono text-xs text-muted-foreground">{timeAgo(bounty.createdAt)}</span>
            </div>

            <h3 className="font-bold text-base truncate pr-2">{bounty.title || "Untitled Bounty"}</h3>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {bounty.rewardAmount && (
                <span className="font-mono text-sm font-bold text-primary">
                  {bounty.rewardAmount} {bounty.rewardCurrency}
                </span>
              )}
              {bounty.contentFormat && (
                <span className="font-mono text-xs text-muted-foreground border border-border px-2 py-0.5 rounded-sm">
                  {bounty.contentFormat}
                </span>
              )}
              {daysLeft !== null && (
                <span className={`font-mono text-xs flex items-center gap-1 ${daysLeft < 3 ? "text-red-400" : daysLeft < 7 ? "text-yellow-400" : "text-muted-foreground"}`}>
                  <Clock className="w-3 h-3" />
                  {daysLeft < 0 ? "Expired" : daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                </span>
              )}
              {bounty.confidenceScore != null && (
                <span className="font-mono text-xs text-blue-400/70 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {bounty.confidenceScore}%
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            {score > 0 && (
              <div className={`flex items-center gap-1 border px-3 py-1.5 rounded-sm ${SCORE_COLOR(score)}`}>
                <span className="font-mono text-lg font-bold">{score}</span>
                <span className="font-mono text-xs">/10</span>
              </div>
            )}
            <Button
              onClick={onClaim}
              disabled={isClaiming || isClaimed}
              size="sm"
              className={`font-mono text-xs uppercase tracking-wider ${isClaimed ? "bg-green-600 hover:bg-green-600" : ""}`}
            >
              {isClaiming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isClaimed ? (
                <><CheckCircle className="w-3.5 h-3.5 mr-1" /> Added</>
              ) : (
                <><Plus className="w-3.5 h-3.5 mr-1" /> Add to Pipeline</>
              )}
            </Button>
          </div>
        </div>

        {bounty.scoreExplanation && (
          <p className="font-mono text-xs text-muted-foreground mt-3 line-clamp-2">{bounty.scoreExplanation}</p>
        )}
      </CardContent>
    </Card>
  );
}
