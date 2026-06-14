import { useState } from "react";
import { Link } from "wouter";
import {
  useListBounties,
  getListBountiesQueryKey,
  useDeleteBounty,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Clock, Check } from "lucide-react";

function timeLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (days > 0) return `${days}d ${hrs}h ${mins}m ${secs}s`;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

const STATUS_COLORS: Record<string, string> = {
  discovered: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  saved_for_later: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-300 border-green-500/30",
  rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  researching: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  scripting: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  recording: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  editing: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  submitted: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  won: "bg-primary/20 text-primary border-primary/30",
  lost: "bg-muted text-muted-foreground border-border",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 7) return "text-green-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
};

const ALL_STATUSES = [
  "discovered", "saved_for_later", "approved", "rejected",
  "researching", "scripting", "recording", "editing",
  "submitted", "won", "lost",
];

const PLATFORMS = ["Superteam Earn", "GibWork", "First Dollar", "DoraHacks", "Gitcoin"];

export function Bounties() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const queryClient = useQueryClient();

  const params = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(platformFilter ? { platform: platformFilter } : {}),
    ...(activeOnly ? { active: "true" } : {}),
  };

  const { data: bounties, isLoading } = useListBounties(params);
  const deleteMutation = useDeleteBounty();

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this bounty?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">All Bounties</h1>
          <p className="text-muted-foreground font-mono mt-1 text-sm">
            {bounties?.length ?? 0} bounties found
          </p>
        </div>
        <Link href="/bounties/add">
          <Button className="font-mono uppercase tracking-wider">
            <Plus className="w-4 h-4 mr-2" /> Hunt Bounty
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-card border border-border text-sm font-mono px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ").toUpperCase()}</option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-card border border-border text-sm font-mono px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={`bg-card border border-border text-sm font-mono px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex items-center gap-2 transition-colors ${activeOnly ? "border-primary/50 text-primary" : ""}`}
        >
          {activeOnly ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {activeOnly ? "Active Only" : "Include Expired"}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !bounties || bounties.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground font-mono">
          <p className="text-lg">No bounties found.</p>
          <Link href="/bounties/add">
            <Button variant="outline" className="mt-4 font-mono uppercase">Add your first bounty</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bounties.map((bounty) => (
            <Link key={bounty.id} href={`/bounties/${bounty.id}`}>
              <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-sm leading-tight line-clamp-2 flex-1">
                      {bounty.title || "Untitled Bounty"}
                    </h3>
                    <button
                      onClick={(e) => handleDelete(e, bounty.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${STATUS_COLORS[bounty.status] || "bg-muted text-muted-foreground"}`}>
                      {bounty.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {bounty.platform && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground">
                        {bounty.platform}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-auto">
                    <div>
                      <div className="text-primary font-bold font-mono text-lg">
                        {bounty.rewardAmount ? (bounty.rewardAmount.includes("-") ? `${bounty.rewardAmount}` : `$${bounty.rewardAmount}`) : "?"}
                        {bounty.rewardCurrency && (
                          <span className="text-xs text-muted-foreground ml-1">{bounty.rewardCurrency}</span>
                        )}
                        {bounty.prizeRank && (
                          <span className="inline-block ml-1 text-xs text-primary/70 border border-primary/30 px-1.5 py-0.5 rounded">{bounty.prizeRank}</span>
                        )}
                      </div>
                      {bounty.deadline && (
                        <div className="text-xs text-muted-foreground font-mono">{timeLeft(bounty.deadline)}</div>
                      )}
                    </div>
                    {bounty.opportunityScore != null && (
                      <div className="text-right">
                        <div className={`text-2xl font-bold font-mono ${SCORE_COLOR(bounty.opportunityScore)}`}>
                          {bounty.opportunityScore}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">/ 10 <span className="inline-block ml-0.5 px-1 bg-primary/10 rounded text-[8px] text-primary/70">AI</span></div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
