import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetBounty,
  getGetBountyQueryKey,
  useGetResearchBriefByBounty,
  getGetResearchBriefByBountyQueryKey,
  useGetProductionPlanByBounty,
  getGetProductionPlanByBountyQueryKey,
  useUpdateBounty,
  useCreateSubmission,
  getListBountiesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListSubmissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ExternalLink, RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";

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

const WORKFLOW_STATUSES = [
  "approved", "researching", "scripting", "recording", "editing",
];

export function BountyDetail() {
  const { id } = useParams<{ id: string }>();
  const bountyId = parseInt(id ?? "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const { data: bounty, isLoading: loadingBounty } = useGetBounty(bountyId, {
    query: { enabled: !!bountyId, queryKey: getGetBountyQueryKey(bountyId) },
  });
  const { data: brief, isLoading: loadingBrief } = useGetResearchBriefByBounty(bountyId, {
    query: { enabled: !!bountyId, queryKey: getGetResearchBriefByBountyQueryKey(bountyId) },
  });
  const { data: plan, isLoading: loadingPlan } = useGetProductionPlanByBounty(bountyId, {
    query: { enabled: !!bountyId, queryKey: getGetProductionPlanByBountyQueryKey(bountyId) },
  });

  const updateMutation = useUpdateBounty();
  const createSubmission = useCreateSubmission();

  // Submit form state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitDate, setSubmitDate] = useState(new Date().toISOString().slice(0, 10));

  // Rescrape state
  const [rescraping, setRescraping] = useState(false);
  const [rescrapeResult, setRescrapeResult] = useState<{ prevConfidence: number; newConfidence: number } | null>(null);

  const handleStatusChange = (status: string) => {
    updateMutation.mutate(
      { id: bountyId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBountyQueryKey(bountyId) });
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      }
    );
  };

  const handleMarkSubmitted = (e: React.FormEvent) => {
    e.preventDefault();
    createSubmission.mutate(
      {
        data: {
          bountyId,
          submissionUrl: submitUrl || undefined,
          submittedAt: new Date(submitDate).toISOString(),
          notes: undefined,
        },
      },
      {
        onSuccess: () => {
          setShowSubmitForm(false);
          setSubmitUrl("");
          queryClient.invalidateQueries({ queryKey: getGetBountyQueryKey(bountyId) });
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
        },
      }
    );
  };

  const handleRescrape = async () => {
    if (!token || rescraping) return;
    setRescraping(true);
    setRescrapeResult(null);
    try {
      const resp = await fetch(`/api/bounties/${bountyId}/rescrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setRescrapeResult({ prevConfidence: data.prevConfidence, newConfidence: data.newConfidence });
        queryClient.invalidateQueries({ queryKey: getGetBountyQueryKey(bountyId) });
        queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
      }
    } finally {
      setRescraping(false);
    }
  };

  if (loadingBounty) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="text-center py-20 text-muted-foreground font-mono">
        <p>Bounty not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/bounties")}>
          Back to Bounties
        </Button>
      </div>
    );
  }

  const confidencePct = Math.round(bounty.confidenceScore ?? 0);
  const lowConfidence = (bounty.confidenceScore ?? 100) < 55;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/bounties")} className="font-mono">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">
            {bounty.title || "Untitled Bounty"}
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${STATUS_COLORS[bounty.status] || "bg-muted"}`}>
              {bounty.status.replace(/_/g, " ").toUpperCase()}
            </span>
            {bounty.platform && (
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-border bg-secondary text-muted-foreground">
                {bounty.platform}
              </span>
            )}
            {bounty.confidenceScore != null && (
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${lowConfidence ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-border text-muted-foreground"}`}>
                {confidencePct}% confidence
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {bounty.opportunityScore != null && (
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-bold font-mono ${SCORE_COLOR(bounty.opportunityScore)}`}>
                {bounty.opportunityScore}
              </span>
              <span className="text-muted-foreground font-mono text-lg">/10</span>
            </div>
          )}
          <span className="text-primary font-bold font-mono text-xl">
            {bounty.rewardAmount ? `$${bounty.rewardAmount}` : "TBD"}
            {bounty.rewardCurrency && <span className="text-sm ml-1 text-muted-foreground">{bounty.rewardCurrency}</span>}
          </span>
        </div>
      </div>

      {bounty.opportunityScore != null && bounty.scoreExplanation && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">Score Explanation</p>
            <p className="text-sm">{bounty.scoreExplanation}</p>
          </CardContent>
        </Card>
      )}

      {/* Agentic Retry Extraction */}
      {(lowConfidence || rescrapeResult) && (
        <Card className={`border ${lowConfidence && !rescrapeResult ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card"}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${lowConfidence && !rescrapeResult ? "text-yellow-400" : "text-muted-foreground"}`} />
              <div className="flex-1">
                {rescrapeResult ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="font-mono text-xs text-green-400">
                      Extraction retry complete — confidence {Math.round(rescrapeResult.prevConfidence)}% → {Math.round(rescrapeResult.newConfidence)}%
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-xs text-yellow-400 uppercase tracking-wider">Low extraction confidence ({confidencePct}%)</p>
                    <p className="text-xs text-muted-foreground mt-1">Some fields may be missing or inaccurate. The agent can retry extraction to improve the data.</p>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRescrape}
                disabled={rescraping}
                className="font-mono text-xs uppercase tracking-wider border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 flex-shrink-0"
              >
                {rescraping ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                {rescraping ? "Retrying..." : "Retry Extraction"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Bounty Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Field label="Platform" value={bounty.platform} />
          <Field label="Project" value={bounty.projectName} />
          <Field label="Deadline" value={bounty.deadline ? new Date(bounty.deadline).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : null} />
          <Field label="Content Format" value={bounty.contentFormat} />
          <Field label="Deliverables" value={bounty.deliverables} className="md:col-span-2" />
          <Field label="Submission Requirements" value={bounty.submissionRequirements} className="md:col-span-2" />
          <Field label="Eligibility Rules" value={bounty.eligibilityRules} className="md:col-span-2" />
          <Field label="Important Notes" value={bounty.importantNotes} className="md:col-span-2" />
          {bounty.submissionLink && (
            <div className="md:col-span-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">Submission Link</p>
              <a
                href={bounty.submissionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                {bounty.submissionLink} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          <div>
            <a href={bounty.url} target="_blank" rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 text-sm hover:underline">
              Original URL <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {bounty.status !== "rejected" && bounty.status !== "lost" && bounty.status !== "won" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Update Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {WORKFLOW_STATUSES.map((s) => (
                <Button
                  key={s}
                  variant={bounty.status === s ? "default" : "outline"}
                  size="sm"
                  className="font-mono uppercase text-xs"
                  onClick={() => handleStatusChange(s)}
                  disabled={updateMutation.isPending}
                >
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
              {bounty.status !== "submitted" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono uppercase text-xs border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                  onClick={() => setShowSubmitForm(!showSubmitForm)}
                  disabled={updateMutation.isPending}
                >
                  ✓ Mark as Submitted
                </Button>
              )}
            </div>

            {showSubmitForm && (
              <form onSubmit={handleMarkSubmitted} className="border border-teal-500/20 rounded-sm p-4 bg-teal-500/5 flex flex-col gap-3">
                <p className="font-mono text-xs uppercase tracking-wider text-teal-400">Log Submission</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Submission URL</label>
                    <Input
                      value={submitUrl}
                      onChange={(e) => setSubmitUrl(e.target.value)}
                      placeholder="https://..."
                      className="font-mono text-sm bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Date Submitted</label>
                    <Input
                      type="date"
                      value={submitDate}
                      onChange={(e) => setSubmitDate(e.target.value)}
                      className="font-mono text-sm bg-background border-border"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createSubmission.isPending}
                    className="font-mono uppercase text-xs bg-teal-600 hover:bg-teal-500 text-white border-0"
                  >
                    {createSubmission.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Confirm Submission
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="font-mono uppercase text-xs"
                    onClick={() => setShowSubmitForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Won / Lost result update */}
      {bounty.status === "submitted" && (
        <Card className="bg-card border-teal-500/20">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Record Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="font-mono uppercase text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={() => handleStatusChange("won")}
                disabled={updateMutation.isPending}
              >
                🏆 Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono uppercase text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => handleStatusChange("lost")}
                disabled={updateMutation.isPending}
              >
                ✗ Lost
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loadingBrief ? (
        <Skeleton className="h-32 w-full" />
      ) : brief ? (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Research Brief</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <Field label="Summary" value={brief.summary} />
            <Field label="Content Angles" value={brief.contentAngles} />
            <Field label="Key Points" value={brief.keyPoints} />
            <Field label="Target Audience" value={brief.targetAudience} />
            <Field label="Competitor Analysis" value={brief.competitorAnalysis} />
          </CardContent>
        </Card>
      ) : null}

      {loadingPlan ? (
        <Skeleton className="h-32 w-full" />
      ) : plan ? (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Production Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {plan.estimatedHours && (
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">Estimated Time</p>
                <p className="text-primary font-bold font-mono">{plan.estimatedHours}h</p>
              </div>
            )}
            <PreField label="Script Outline" value={plan.scriptOutline} />
            <PreField label="Shot List" value={plan.shotList} />
            <Field label="Caption Draft" value={plan.captionDraft} />
            <PreField label="Submission Checklist" value={plan.submissionChecklist} />
          </CardContent>
        </Card>
      ) : null}
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
      <p className="text-sm">{value}</p>
    </div>
  );
}

function PreField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <pre className="text-sm font-mono whitespace-pre-wrap bg-background border border-border rounded-sm p-3 leading-relaxed">
        {value}
      </pre>
    </div>
  );
}
