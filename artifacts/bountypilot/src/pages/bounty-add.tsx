import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateBounty,
  useApproveBounty,
  useRejectBounty,
  useSaveBountyForLater,
  getListBountiesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentBountiesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

const SCORE_COLOR = (score: number) => {
  if (score >= 7) return "text-green-400 border-green-400/50 bg-green-400/10";
  if (score >= 4) return "text-yellow-400 border-yellow-400/50 bg-yellow-400/10";
  return "text-red-400 border-red-400/50 bg-red-400/10";
};

type BountyResult = {
  id: number;
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
  status: string;
};

export function BountyAdd() {
  const [url, setUrl] = useState("");
  const [extracted, setExtracted] = useState<BountyResult | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const createMutation = useCreateBounty();
  const approveMutation = useApproveBounty();
  const rejectMutation = useRejectBounty();
  const saveMutation = useSaveBountyForLater();

  const isLoading = createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    createMutation.mutate(
      { data: { url } },
      {
        onSuccess: (bounty) => {
          setExtracted(bounty as BountyResult);
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
        },
      }
    );
  };

  const handleApprove = () => {
    if (!extracted) return;
    approveMutation.mutate(
      { id: extracted.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentBountiesQueryKey() });
          setActionDone("approved");
          setTimeout(() => navigate(`/bounties/${extracted.id}`), 1200);
        },
      }
    );
  };

  const handleReject = () => {
    if (!extracted) return;
    rejectMutation.mutate(
      { id: extracted.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          setActionDone("rejected");
          setTimeout(() => navigate("/bounties"), 1200);
        },
      }
    );
  };

  const handleSave = () => {
    if (!extracted) return;
    saveMutation.mutate(
      { id: extracted.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          setActionDone("saved");
          setTimeout(() => navigate("/bounties"), 1200);
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Hunt Bounty</h1>
        <p className="text-muted-foreground font-mono mt-2 text-sm">
          Paste a bounty URL. The AI agent will extract and score the opportunity.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Bounty URL
            </label>
            <div className="flex gap-3">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://earn.superteam.fun/listing/..."
                className="font-mono text-sm flex-1 bg-background border-border focus:ring-primary"
                disabled={isLoading || !!extracted}
              />
              <Button
                type="submit"
                disabled={isLoading || !url.trim() || !!extracted}
                className="font-mono uppercase tracking-wider whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze"
                )}
              </Button>
            </div>
            {createMutation.isError && (
              <p className="text-red-400 text-xs font-mono">
                Failed to analyze bounty. Check the URL and try again.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground font-mono">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Extracting bounty details and scoring opportunity...</p>
        </div>
      )}

      {extracted && !actionDone && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold font-sans text-xl uppercase">Extraction Result</h2>
            <div className={`flex items-center gap-2 border px-4 py-2 rounded-sm ${SCORE_COLOR(extracted.opportunityScore ?? 0)}`}>
              <span className="font-mono text-3xl font-bold">{extracted.opportunityScore ?? "?"}</span>
              <span className="font-mono text-xs">/10</span>
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Field label="Title" value={extracted.title} />
              <Field label="Platform" value={extracted.platform} />
              <Field label="Project" value={extracted.projectName} />
              <Field label="Reward" value={extracted.rewardAmount ? `${extracted.rewardAmount} ${extracted.rewardCurrency ?? ""}` : null} />
              <Field label="Deadline" value={extracted.deadline} />
              <Field label="Content Format" value={extracted.contentFormat} />
              <Field label="Deliverables" value={extracted.deliverables} className="md:col-span-2" />
              <Field label="Submission Requirements" value={extracted.submissionRequirements} className="md:col-span-2" />
              <Field label="Eligibility" value={extracted.eligibilityRules} className="md:col-span-2" />
              <Field label="Important Notes" value={extracted.importantNotes} className="md:col-span-2" />
            </CardContent>
          </Card>

          {extracted.scoreExplanation && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">Score Explanation</p>
                <p className="text-sm text-foreground">{extracted.scoreExplanation}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="flex-1 font-mono uppercase tracking-wider bg-green-600 hover:bg-green-500 text-white"
            >
              {approveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              variant="destructive"
              className="flex-1 font-mono uppercase tracking-wider"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Reject
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              variant="outline"
              className="flex-1 font-mono uppercase tracking-wider"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Save for Later
            </Button>
          </div>
        </div>
      )}

      {actionDone === "approved" && (
        <div className="flex items-center gap-3 p-4 border border-green-500/30 bg-green-500/10 rounded-sm font-mono text-sm text-green-400">
          <CheckCircle className="w-5 h-5" />
          Bounty approved. Generating research brief and production plan...
        </div>
      )}
      {actionDone === "rejected" && (
        <div className="flex items-center gap-3 p-4 border border-red-500/30 bg-red-500/10 rounded-sm font-mono text-sm text-red-400">
          <XCircle className="w-5 h-5" />
          Bounty rejected.
        </div>
      )}
      {actionDone === "saved" && (
        <div className="flex items-center gap-3 p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-sm font-mono text-sm text-yellow-400">
          <Clock className="w-5 h-5" />
          Saved for later.
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={className}>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
