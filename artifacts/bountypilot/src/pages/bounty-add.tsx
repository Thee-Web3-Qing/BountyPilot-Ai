import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateBounty,
  useUpdateBounty,
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, XCircle, Clock, Pencil, AlertCircle } from "lucide-react";

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

type EditableFields = {
  title: string;
  projectName: string;
  rewardAmount: string;
  rewardCurrency: string;
  deadline: string;
  contentFormat: string;
  deliverables: string;
  submissionRequirements: string;
  eligibilityRules: string;
  importantNotes: string;
};

function bountyToEditable(b: BountyResult): EditableFields {
  return {
    title: b.title || "",
    projectName: b.projectName || "",
    rewardAmount: b.rewardAmount || "",
    rewardCurrency: b.rewardCurrency || "USDC",
    deadline: b.deadline || "",
    contentFormat: b.contentFormat || "",
    deliverables: b.deliverables || "",
    submissionRequirements: b.submissionRequirements || "",
    eligibilityRules: b.eligibilityRules || "",
    importantNotes: b.importantNotes || "",
  };
}

function countMissing(fields: EditableFields): number {
  return [fields.title, fields.rewardAmount, fields.deadline, fields.contentFormat].filter(
    (v) => !v || v.trim() === ""
  ).length;
}

export function BountyAdd() {
  const [url, setUrl] = useState("");
  const [extracted, setExtracted] = useState<BountyResult | null>(null);
  const [editFields, setEditFields] = useState<EditableFields | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const createMutation = useCreateBounty();
  const updateMutation = useUpdateBounty();
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
          const b = bounty as BountyResult;
          setExtracted(b);
          setEditFields(bountyToEditable(b));
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
        },
      }
    );
  };

  const setField = (key: keyof EditableFields, value: string) => {
    setEditFields((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveEditsIfNeeded = async (): Promise<boolean> => {
    if (!extracted || !editFields) return false;
    const hasChanges =
      editFields.title !== (extracted.title ?? "") ||
      editFields.rewardAmount !== (extracted.rewardAmount ?? "") ||
      editFields.deadline !== (extracted.deadline ?? "");

    if (!hasChanges) return true;

    setIsSavingEdits(true);
    return new Promise((resolve) => {
      updateMutation.mutate(
        {
          id: extracted.id,
          data: {
            title: editFields.title || undefined,
            rewardAmount: editFields.rewardAmount || undefined,
            deadline: editFields.deadline || undefined,
          },
        },
        {
          onSuccess: () => {
            setIsSavingEdits(false);
            resolve(true);
          },
          onError: () => {
            setIsSavingEdits(false);
            resolve(true);
          },
        }
      );
    });
  };

  const handleApprove = async () => {
    if (!extracted) return;
    await saveEditsIfNeeded();
    approveMutation.mutate(
      { id: extracted.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBountiesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentBountiesQueryKey() });
          setActionDone("approved");
          setTimeout(() => navigate(`/bounties/${extracted.id}`), 1500);
        },
      }
    );
  };

  const handleReject = async () => {
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

  const handleSave = async () => {
    if (!extracted) return;
    await saveEditsIfNeeded();
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

  const missing = editFields ? countMissing(editFields) : 0;

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Hunt Bounty</h1>
        <p className="text-muted-foreground font-mono mt-2 text-sm">
          Paste a bounty URL. We extract what we can — you review and fill in the rest.
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
                placeholder="https://earn.superteam.fun/listing/... or any bounty URL"
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
                    Scanning...
                  </>
                ) : (
                  "Scan URL"
                )}
              </Button>
            </div>
            {createMutation.isError && (
              <p className="text-red-400 text-xs font-mono">
                Failed to scan URL. Check the address and try again.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground font-mono">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Scanning page and scoring opportunity...</p>
        </div>
      )}

      {extracted && editFields && !actionDone && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold font-sans text-xl uppercase">Review & Edit</h2>
              <p className="text-muted-foreground font-mono text-xs mt-1">
                <Pencil className="inline w-3 h-3 mr-1" />
                All fields are editable — fix anything the scan missed
              </p>
            </div>
            <div
              className={`flex items-center gap-2 border px-4 py-2 rounded-sm ${SCORE_COLOR(extracted.opportunityScore ?? 0)}`}
            >
              <span className="font-mono text-3xl font-bold">
                {extracted.opportunityScore ?? "?"}
              </span>
              <span className="font-mono text-xs">/10</span>
            </div>
          </div>

          {missing > 0 && (
            <div className="flex items-center gap-2 text-yellow-400 font-mono text-xs border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 rounded-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {missing} field{missing > 1 ? "s" : ""} couldn't be auto-extracted — fill them in below
              for a better experience.
            </div>
          )}

          <Card className="bg-card border-border">
            <CardContent className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <EditField
                  label="Title"
                  value={editFields.title}
                  onChange={(v) => setField("title", v)}
                  placeholder="Bounty title"
                  className="md:col-span-2"
                  highlight={!editFields.title}
                />
                <EditField
                  label="Project / Sponsor"
                  value={editFields.projectName}
                  onChange={(v) => setField("projectName", v)}
                  placeholder="e.g. Orca, Jito, Gitcoin"
                />
                <EditField
                  label="Platform"
                  value={extracted.platform ?? ""}
                  onChange={() => {}}
                  placeholder="Platform"
                  readOnly
                />
                <EditField
                  label="Reward Amount"
                  value={editFields.rewardAmount}
                  onChange={(v) => setField("rewardAmount", v)}
                  placeholder="e.g. 1500"
                  highlight={!editFields.rewardAmount}
                />
                <EditField
                  label="Currency"
                  value={editFields.rewardCurrency}
                  onChange={(v) => setField("rewardCurrency", v)}
                  placeholder="USDC / SOL / ETH"
                />
                <EditField
                  label="Deadline (YYYY-MM-DD)"
                  value={editFields.deadline}
                  onChange={(v) => setField("deadline", v)}
                  placeholder="2025-12-31"
                  highlight={!editFields.deadline}
                />
                <EditField
                  label="Content Format"
                  value={editFields.contentFormat}
                  onChange={(v) => setField("contentFormat", v)}
                  placeholder="e.g. Video + Twitter Thread"
                  highlight={!editFields.contentFormat}
                />
                <EditField
                  label="Deliverables"
                  value={editFields.deliverables}
                  onChange={(v) => setField("deliverables", v)}
                  placeholder="What exactly must be submitted?"
                  className="md:col-span-2"
                />
                <TextareaField
                  label="Submission Requirements"
                  value={editFields.submissionRequirements}
                  onChange={(v) => setField("submissionRequirements", v)}
                  placeholder="Word count, format rules, publish requirements..."
                  className="md:col-span-2"
                />
                <TextareaField
                  label="Eligibility Rules"
                  value={editFields.eligibilityRules}
                  onChange={(v) => setField("eligibilityRules", v)}
                  placeholder="Who can apply?"
                />
                <TextareaField
                  label="Important Notes"
                  value={editFields.importantNotes}
                  onChange={(v) => setField("importantNotes", v)}
                  placeholder="Judging criteria, prizes, etc."
                />
              </div>
            </CardContent>
          </Card>

          {extracted.scoreExplanation && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Score Explanation
                </p>
                <p className="text-sm text-foreground">{extracted.scoreExplanation}</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleApprove}
              disabled={
                approveMutation.isPending || isSavingEdits || !editFields.title.trim()
              }
              className="flex-1 font-mono uppercase tracking-wider bg-green-600 hover:bg-green-500 text-white"
            >
              {approveMutation.isPending || isSavingEdits ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Approve & Generate Brief
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || isSavingEdits}
              variant="outline"
              className="flex-1 font-mono uppercase tracking-wider"
            >
              {saveMutation.isPending || isSavingEdits ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Save for Later
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              variant="destructive"
              className="sm:w-auto font-mono uppercase tracking-wider"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Reject
            </Button>
          </div>
        </div>
      )}

      {actionDone === "approved" && (
        <div className="flex items-center gap-3 p-4 border border-green-500/30 bg-green-500/10 rounded-sm font-mono text-sm text-green-400">
          <CheckCircle className="w-5 h-5" />
          Approved! Generating research brief and production plan...
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

function EditField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  readOnly = false,
  highlight = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  readOnly?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={className}>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">
        {label}
        {highlight && <span className="ml-2 text-yellow-400">✱</span>}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`font-mono text-sm bg-background border-border ${
          readOnly ? "opacity-60 cursor-default" : ""
        } ${highlight ? "border-yellow-500/50 focus:border-yellow-400" : ""}`}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">
        {label}
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm bg-background border-border min-h-[80px] resize-y"
      />
    </div>
  );
}
