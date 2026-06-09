import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, RefreshCw, Globe, Plus, CheckCircle,
  Clock, Search, Zap, Shield, ExternalLink, X,
  Sparkles, AlertCircle,
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
  submissionRequirements: string | null;
  deliverables: string | null;
  eligibilityRules: string | null;
  importantNotes: string | null;
  opportunityScore: number | null;
  scoreExplanation: string | null;
  confidenceScore: number | null;
  status: string;
  createdAt: string;
}

interface UserProfile {
  contentFormats: string | null;
  minimumReward: number | null;
  skillLevel: string | null;
  niche: string | null;
}

interface PlatformResult {
  platform: string;
  added: number;
  skipped: number;
  error?: string;
  durationMs: number;
}

interface CrawlerStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  lastResults: PlatformResult[];
  totalAddedLastRun: number;
  totalCrawledBounties: number;
}

// Strip residual HTML tags and decode entities for safe plain-text display
function stripHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.round((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function scoreColor(score: number): string {
  if (score >= 7) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 7) return "border-green-500/40 bg-green-500/10";
  if (score >= 5) return "border-yellow-500/40 bg-yellow-500/10";
  return "border-red-500/40 bg-red-500/10";
}

// Check if a bounty matches the user's profile preferences
function matchesProfile(bounty: DiscoveredBounty, profile: UserProfile): boolean {
  // Minimum reward check
  if (profile.minimumReward && profile.minimumReward > 0) {
    const reward = bounty.rewardAmount ? parseFloat(bounty.rewardAmount) : 0;
    if (reward < profile.minimumReward) return false;
  }
  // Content format check — match any overlapping keyword
  if (profile.contentFormats) {
    const userFmts = profile.contentFormats.toLowerCase();
    const bountyFmt = (bounty.contentFormat || "").toLowerCase();
    const keywords = ["video", "thread", "article", "newsletter", "podcast", "infographic", "blog"];
    const userKws = keywords.filter((k) => userFmts.includes(k));
    if (userKws.length > 0 && !userKws.some((k) => bountyFmt.includes(k))) return false;
  }
  return true;
}

// ─── Bounty Detail Drawer ──────────────────────────────────────────────────
function DetailDrawer({
  bounty,
  onClose,
  onClaim,
  isClaiming,
  isClaimed,
}: {
  bounty: DiscoveredBounty;
  onClose: () => void;
  onClaim: () => void;
  isClaiming: boolean;
  isClaimed: boolean;
}) {
  const dl = daysLeft(bounty.deadline);
  const score = bounty.opportunityScore ?? 0;
  const requirements = stripHtml(bounty.submissionRequirements);
  const deliverables = stripHtml(bounty.deliverables);
  const eligibility = stripHtml(bounty.eligibilityRules);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-[#111] border border-border rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm whitespace-nowrap">
                {bounty.platform || "Unknown"}
              </span>
              {bounty.projectName && (
                <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {bounty.projectName}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-tight">{bounty.title || "Untitled Bounty"}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-sm p-3 text-center">
              <div className="font-mono text-xs text-muted-foreground mb-1">Reward</div>
              <div className="font-bold text-primary text-sm">
                {bounty.rewardAmount && Number(bounty.rewardAmount) > 0
                  ? `${bounty.rewardAmount} ${bounty.rewardCurrency || "USDC"}`
                  : <span className="text-muted-foreground text-xs">See platform</span>}
              </div>
            </div>
            <div className="bg-card border border-border rounded-sm p-3 text-center">
              <div className="font-mono text-xs text-muted-foreground mb-1">Deadline</div>
              <div className={`font-mono text-sm font-bold ${dl === null ? "text-muted-foreground text-xs" : dl < 0 ? "text-muted-foreground/50" : dl < 3 ? "text-red-400" : dl < 7 ? "text-yellow-400" : "text-foreground"}`}>
                {dl === null ? "Open" : dl < 0 ? "Expired" : dl === 0 ? "Today" : `${dl}d`}
              </div>
            </div>
            <div className={`border rounded-sm p-3 text-center ${scoreBg(score)}`}>
              <div className="font-mono text-xs text-muted-foreground mb-1">Score</div>
              <div className={`font-bold text-lg ${scoreColor(score)}`}>{score}<span className="text-xs font-normal">/10</span></div>
            </div>
          </div>

          {/* Score explanation */}
          {bounty.scoreExplanation && (
            <div className="bg-card border border-border rounded-sm p-3">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Analysis</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{bounty.scoreExplanation}</p>
            </div>
          )}

          {/* Content format */}
          {bounty.contentFormat && (
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Format</p>
              <span className="font-mono text-xs border border-border px-2 py-1 rounded-sm text-foreground">{bounty.contentFormat}</span>
            </div>
          )}

          {/* Requirements */}
          {requirements && (
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Requirements</p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{requirements}</p>
            </div>
          )}

          {/* Deliverables */}
          {deliverables && deliverables !== bounty.contentFormat && (
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Deliverables</p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{deliverables}</p>
            </div>
          )}

          {/* Eligibility */}
          {eligibility && (
            <div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Eligibility</p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{eligibility}</p>
            </div>
          )}

          {/* Confidence */}
          {bounty.confidenceScore != null && (
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              Data confidence: <span className="text-blue-400">{bounty.confidenceScore}%</span>
              <span className="ml-1">· added {timeAgo(bounty.createdAt)}</span>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="p-4 border-t border-border flex gap-3">
          <a
            href={bounty.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider border border-border rounded-sm py-2.5 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Visit Source
          </a>
          <Button
            onClick={onClaim}
            disabled={isClaiming || isClaimed}
            className={`flex-1 font-mono text-xs uppercase tracking-wider ${isClaimed ? "bg-green-600 hover:bg-green-600" : ""}`}
          >
            {isClaiming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isClaimed ? (
              <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Added!</>
            ) : (
              <><Plus className="w-3.5 h-3.5 mr-1.5" />Add to Pipeline</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Bounty Card ───────────────────────────────────────────────────────────
function BountyCard({
  bounty,
  isClaiming,
  isClaimed,
  onClaim,
  onExpand,
}: {
  bounty: DiscoveredBounty;
  isClaiming: boolean;
  isClaimed: boolean;
  onClaim: (e: React.MouseEvent) => void;
  onExpand: () => void;
}) {
  const score = bounty.opportunityScore ?? 0;
  const dl = daysLeft(bounty.deadline);

  return (
    <div
      onClick={onExpand}
      className="bg-card border border-border hover:border-primary/40 active:border-primary/60 rounded-sm p-4 cursor-pointer transition-colors"
    >
      {/* Row 1: platform + time */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm whitespace-nowrap leading-tight">
          {bounty.platform || "Unknown"}
        </span>
        {bounty.projectName && (
          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
            {bounty.projectName}
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto whitespace-nowrap">
          {timeAgo(bounty.createdAt)}
        </span>
      </div>

      {/* Row 2: title */}
      <h3 className="font-bold text-base leading-snug mb-3 line-clamp-2 pr-1">
        {bounty.title || "Untitled Bounty"}
      </h3>

      {/* Row 3: metrics + score */}
      <div className="flex items-center gap-2 flex-wrap">
        {bounty.rewardAmount && Number(bounty.rewardAmount) > 0 ? (
          <span className="font-mono text-sm font-bold text-primary whitespace-nowrap">
            {bounty.rewardAmount} {bounty.rewardCurrency || "USDC"}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground/50">reward TBD</span>
        )}

        {bounty.contentFormat && (
          <span className="font-mono text-[10px] border border-border px-1.5 py-0.5 rounded-sm text-muted-foreground whitespace-nowrap">
            {bounty.contentFormat.split("/")[0].trim()}
          </span>
        )}

        {dl !== null && (
          <span className={`font-mono text-[10px] flex items-center gap-1 whitespace-nowrap ${dl < 0 ? "text-muted-foreground/50" : dl < 3 ? "text-red-400" : dl < 7 ? "text-yellow-400" : "text-muted-foreground"}`}>
            <Clock className="w-3 h-3 shrink-0" />
            {dl < 0 ? "Expired" : dl === 0 ? "Today" : `${dl}d`}
          </span>
        )}

        <div className={`ml-auto flex items-center gap-0.5 border px-2 py-1 rounded-sm shrink-0 ${scoreBg(score)}`}>
          <span className={`font-mono text-base font-bold leading-none ${scoreColor(score)}`}>{score}</span>
          <span className="font-mono text-[10px] text-muted-foreground">/10</span>
        </div>
      </div>

      {/* Row 4: add button */}
      <div className="mt-3 flex items-center gap-2">
        <Button
          onClick={onClaim}
          disabled={isClaiming || isClaimed}
          size="sm"
          className={`font-mono text-xs uppercase tracking-wider flex-1 sm:flex-none ${isClaimed ? "bg-green-600 hover:bg-green-600" : ""}`}
        >
          {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : isClaimed ? <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Added</>
            : <><Plus className="w-3.5 h-3.5 mr-1.5" />Add to Pipeline</>}
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground/50 ml-auto">
          Tap for details
        </span>
      </div>
    </div>
  );
}

// ─── Main Discover Page ────────────────────────────────────────────────────
export function Discover() {
  const [bounties, setBounties] = useState<DiscoveredBounty[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [crawlerStatus, setCrawlerStatus] = useState<CrawlerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<Set<number>>(new Set());
  const [triggering, setTriggering] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [forYouMode, setForYouMode] = useState(false);
  const [selected, setSelected] = useState<DiscoveredBounty | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("bountypilot_token");

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, meRes] = await Promise.all([
        fetch("/api/discover", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/discover/status", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bRes.ok) setBounties(await bRes.json());
      if (sRes.ok) setCrawlerStatus(await sRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        if (me.profile) setProfile(me.profile);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleClaim = async (bountyId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
        if (selected?.id === bountyId) {
          setTimeout(() => navigate(`/bounties/${data.id}`), 900);
        }
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
      setTimeout(fetchData, 3000);
    } finally {
      setTimeout(() => setTriggering(false), 4000);
    }
  };

  const platforms = [...new Set(bounties.map((b) => b.platform).filter(Boolean))] as string[];

  const hasProfileFilter = profile && (
    (profile.minimumReward && profile.minimumReward > 0) ||
    profile.contentFormats
  );

  const forYouCount = hasProfileFilter
    ? bounties.filter((b) => matchesProfile(b, profile!)).length
    : 0;

  const filtered = bounties
    .filter((b) => {
      if (forYouMode && hasProfileFilter && !matchesProfile(b, profile!)) return false;
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
    })
    .sort((a, b) => {
      if (forYouMode) return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
      return 0;
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">Discover</h1>
          <p className="text-muted-foreground font-mono text-xs mt-0.5">
            Monitoring {crawlerStatus?.lastResults?.length ?? 20} platforms · refreshes every hour
            {!!crawlerStatus?.lastResults?.length && crawlerStatus.lastResults.filter(r => (r as PlatformResult & { found?: number }).found ?? 0 > 0).length > 0 && (
              <span className="text-primary ml-1">
                · {crawlerStatus.lastResults.filter(r => (r as PlatformResult & { found?: number }).found ?? 0 > 0).length} live
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            {crawlerStatus?.isRunning ? "Crawling…" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Crawler status bar */}
      {crawlerStatus && (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 rounded-sm border font-mono text-xs ${crawlerStatus.isRunning ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-1.5">
            {crawlerStatus.isRunning
              ? <Loader2 className="w-3 h-3 animate-spin text-primary" />
              : <Globe className="w-3 h-3 text-muted-foreground" />}
            <span className={crawlerStatus.isRunning ? "text-primary" : "text-muted-foreground"}>
              {crawlerStatus.isRunning ? "Crawling…" : "Idle"}
            </span>
          </div>
          {crawlerStatus.lastRunAt && (
            <span className="text-muted-foreground">Last: <span className="text-foreground">{timeAgo(crawlerStatus.lastRunAt)}</span></span>
          )}
          <span className="text-muted-foreground">
            Pool: <span className="text-foreground font-bold">{crawlerStatus.totalCrawledBounties}</span>
          </span>
          {crawlerStatus.totalAddedLastRun > 0 && (
            <span className="text-green-400">+{crawlerStatus.totalAddedLastRun} last run</span>
          )}
          <span className="text-muted-foreground ml-auto">Next: top of hour</span>
        </div>
      )}

      {/* Last crawl per-platform results */}
      {(crawlerStatus?.lastResults?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {crawlerStatus!.lastResults.map((r) => (
            <div
              key={r.platform}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border font-mono text-[10px] ${r.error ? "border-red-500/30 text-red-400" : r.added > 0 ? "border-green-500/30 text-green-400" : "border-border text-muted-foreground"}`}
            >
              {r.error
                ? <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                : r.added > 0
                ? <CheckCircle className="w-2.5 h-2.5 shrink-0" />
                : <Clock className="w-2.5 h-2.5 shrink-0" />}
              <span>{r.platform}</span>
              {r.added > 0 && <span className="font-bold">+{r.added}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bounties…"
          className="pl-9 font-mono text-sm bg-background"
        />
      </div>

      {/* Filter row */}
      <div className="flex gap-1.5 flex-wrap">
        {/* For You smart filter */}
        {hasProfileFilter ? (
          <button
            onClick={() => { setForYouMode(!forYouMode); setFilterPlatform(""); }}
            className={`font-mono text-[11px] px-2.5 py-1 rounded-sm border transition-colors whitespace-nowrap flex items-center gap-1 ${forYouMode ? "bg-primary text-primary-foreground border-primary" : "border-primary/40 text-primary hover:bg-primary/10"}`}
          >
            <Sparkles className="w-3 h-3" />
            For You ({forYouCount})
          </button>
        ) : (
          <button
            onClick={() => navigate("/profile")}
            className="font-mono text-[11px] px-2.5 py-1 rounded-sm border border-dashed border-border text-muted-foreground/60 hover:text-muted-foreground transition-colors whitespace-nowrap flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Set skills for smart filter
          </button>
        )}

        <button
          onClick={() => { setFilterPlatform(""); setForYouMode(false); }}
          className={`font-mono text-[11px] px-2.5 py-1 rounded-sm border transition-colors whitespace-nowrap ${!filterPlatform && !forYouMode ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          All ({bounties.length})
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => { setFilterPlatform(filterPlatform === p ? "" : p); setForYouMode(false); }}
            className={`font-mono text-[11px] px-2.5 py-1 rounded-sm border transition-colors whitespace-nowrap ${filterPlatform === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {p} ({bounties.filter((b) => b.platform === p).length})
          </button>
        ))}
      </div>

      {/* For You context banner */}
      {forYouMode && profile && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-primary/20 bg-primary/5 font-mono text-xs text-primary/80">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>
            Filtered by your profile
            {profile.minimumReward ? ` · min ${profile.minimumReward} USDC` : ""}
            {profile.contentFormats ? ` · ${profile.contentFormats}` : ""}
            {" · "}sorted by score
          </span>
          <button onClick={() => setForYouMode(false)} className="ml-auto hover:text-primary"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Bounties list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground font-mono gap-3 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Globe className="w-10 h-10 text-muted-foreground/30" />
          <div>
            <p className="font-mono text-sm text-muted-foreground">
              {forYouMode ? "No bounties match your profile yet" : "No bounties yet"}
            </p>
            <p className="font-mono text-xs text-muted-foreground/50 mt-1">
              {forYouMode
                ? "Try updating your profile skills, or browse All"
                : crawlerStatus?.isRunning
                ? "Crawl running — check back in a moment"
                : "Click Refresh to pull the latest"}
            </p>
          </div>
          {forYouMode ? (
            <Button onClick={() => setForYouMode(false)} variant="outline" size="sm" className="font-mono text-xs uppercase">
              Show All
            </Button>
          ) : !crawlerStatus?.isRunning ? (
            <Button onClick={handleTrigger} disabled={triggering} variant="outline" size="sm" className="font-mono text-xs uppercase">
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Trigger Crawl
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="font-mono text-xs text-muted-foreground">{filtered.length} bounties{forYouMode ? " matching your profile" : ""}</p>
          {filtered.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              isClaiming={claiming === bounty.id}
              isClaimed={claimed.has(bounty.id)}
              onClaim={(e) => handleClaim(bounty.id, e)}
              onExpand={() => setSelected(bounty)}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          bounty={selected}
          onClose={() => setSelected(null)}
          onClaim={() => handleClaim(selected.id)}
          isClaiming={claiming === selected.id}
          isClaimed={claimed.has(selected.id)}
        />
      )}
    </div>
  );
}
