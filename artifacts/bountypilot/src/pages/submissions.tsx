import { useState } from "react";
import {
  useListSubmissions,
  getListSubmissionsQueryKey,
  useCreateSubmission,
  useUpdateSubmission,
  useListBounties,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2 } from "lucide-react";

const RESULT_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  won: "bg-green-500/20 text-green-300 border-green-500/30",
  lost: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function Submissions() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    bountyId: "",
    submissionUrl: "",
    notes: "",
  });
  const [resultData, setResultData] = useState({
    result: "won",
    rewardReceived: "",
  });

  const queryClient = useQueryClient();
  const { data: submissions, isLoading } = useListSubmissions();
  const { data: bounties } = useListBounties();
  const createMutation = useCreateSubmission();
  const updateMutation = useUpdateSubmission();

  const getBountyTitle = (bountyId: number) =>
    bounties?.find((b) => b.id === bountyId)?.title ?? `Bounty #${bountyId}`;
  const getBountyPlatform = (bountyId: number) =>
    bounties?.find((b) => b.id === bountyId)?.platform ?? "Unknown";

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        data: {
          bountyId: parseInt(formData.bountyId),
          submissionUrl: formData.submissionUrl || undefined,
          notes: formData.notes || undefined,
          submittedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
          setShowForm(false);
          setFormData({ bountyId: "", submissionUrl: "", notes: "" });
        },
      }
    );
  };

  const handleUpdateResult = (id: number) => {
    const sub = submissions?.find((s) => s.id === id);
    updateMutation.mutate(
      {
        id,
        data: {
          result: resultData.result,
          rewardReceived: resultData.rewardReceived ? parseFloat(resultData.rewardReceived) : undefined,
        },
      },
      {
        onSuccess: () => {
          if (typeof pendo !== "undefined") {
            pendo.track("submission_result_updated", {
              submissionId: id,
              bountyId: sub?.bountyId ?? 0,
              result: resultData.result,
              rewardReceived: resultData.rewardReceived ? parseFloat(resultData.rewardReceived) : 0,
              platform: getBountyPlatform(sub?.bountyId ?? 0),
            });
          }
          queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
          setEditingId(null);
          setResultData({ result: "won", rewardReceived: "" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Submissions</h1>
          <p className="text-muted-foreground font-mono mt-1 text-sm">Track your bounty submissions and results.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="font-mono uppercase tracking-wider">
          <Plus className="w-4 h-4 mr-2" /> Log Submission
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card border-primary/30">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">New Submission</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">
                  Bounty
                </label>
                <select
                  value={formData.bountyId}
                  onChange={(e) => setFormData({ ...formData, bountyId: e.target.value })}
                  required
                  className="w-full bg-background border border-border text-sm font-mono px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a bounty...</option>
                  {bounties?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title ?? `Bounty #${b.id}`} ({b.platform})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">
                  Submission URL
                </label>
                <Input
                  value={formData.submissionUrl}
                  onChange={(e) => setFormData({ ...formData, submissionUrl: e.target.value })}
                  placeholder="https://..."
                  className="font-mono text-sm bg-background border-border"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">
                  Notes
                </label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="font-mono text-sm bg-background border-border"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={createMutation.isPending} className="font-mono uppercase tracking-wider">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Submission"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="font-mono uppercase">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !submissions || submissions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground font-mono">
          <p>No submissions logged yet.</p>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Bounty</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Platform</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Submitted</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Result</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Reward</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {getBountyTitle(sub.bountyId)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {getBountyPlatform(sub.bountyId)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded border ${RESULT_COLORS[sub.result ?? "pending"] ?? RESULT_COLORS.pending}`}>
                        {(sub.result ?? "pending").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-primary text-sm font-bold">
                      {sub.rewardReceived ? `$${sub.rewardReceived}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === sub.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={resultData.result}
                            onChange={(e) => setResultData({ ...resultData, result: e.target.value })}
                            className="bg-background border border-border text-xs font-mono px-2 py-1 rounded-sm text-foreground"
                          >
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                            <option value="pending">Pending</option>
                          </select>
                          <Input
                            type="number"
                            value={resultData.rewardReceived}
                            onChange={(e) => setResultData({ ...resultData, rewardReceived: e.target.value })}
                            placeholder="Reward $"
                            className="w-24 h-7 text-xs font-mono bg-background border-border"
                          />
                          <Button size="sm" className="h-7 text-xs font-mono" onClick={() => handleUpdateResult(sub.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                            X
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-mono uppercase"
                          onClick={() => {
                            setEditingId(sub.id);
                            setResultData({ result: sub.result ?? "pending", rewardReceived: sub.rewardReceived?.toString() ?? "" });
                          }}
                        >
                          Update
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
