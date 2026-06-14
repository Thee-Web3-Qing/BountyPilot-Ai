import { useState } from "react";
import {
  useListEarnings,
  getListEarningsQueryKey,
  useCreateEarning,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, TrendingUp } from "lucide-react";
import { trackPendo } from "@/lib/pendo";

const PLATFORMS = ["Superteam Earn", "GibWork", "First Dollar", "DoraHacks", "Gitcoin", "Other"];

export function Earnings() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    platform: "",
    amount: "",
    currency: "USDC",
    notes: "",
  });

  const queryClient = useQueryClient();
  const { data: earnings, isLoading } = useListEarnings();
  const { data: summary } = useGetDashboardSummary();
  const createMutation = useCreateEarning();

  const totalEarnings = earnings?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0;
  const thisMonthEarnings = earnings
    ?.filter((e) => {
      if (!e.receivedAt) return false;
      const d = new Date(e.receivedAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        data: {
          platform: formData.platform || undefined,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          notes: formData.notes || undefined,
          receivedAt: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEarningsQueryKey() });
          trackPendo("EarningLogged", {
            platform: formData.platform,
            amount: parseFloat(formData.amount),
            currency: formData.currency,
          });
          setShowForm(false);
          setFormData({ platform: "", amount: "", currency: "USDC", notes: "" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Earnings</h1>
          <p className="text-muted-foreground font-mono mt-1 text-sm">Track all bounty income.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="font-mono uppercase tracking-wider">
          <Plus className="w-4 h-4 mr-2" /> Log Earning
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-primary">${totalEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">${thisMonthEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Won Bounties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{summary?.wonBounties ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card className="bg-card border-primary/30">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Log New Earning</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full bg-background border border-border text-sm font-mono px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select platform...</option>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="500.00"
                  required
                  className="font-mono text-sm bg-background border-border"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full bg-background border border-border text-sm font-mono px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                  <option value="SOL">SOL</option>
                  <option value="ETH">ETH</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block mb-1">Notes</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="font-mono text-sm bg-background border-border"
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <Button type="submit" disabled={createMutation.isPending} className="font-mono uppercase tracking-wider">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Earning"}
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
      ) : !earnings || earnings.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground font-mono">
          <p>No earnings recorded yet.</p>
          <p className="text-xs mt-2">Log a winning bounty to get started.</p>
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Platform</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Currency</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Notes</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((earning) => (
                  <tr key={earning.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm">{earning.platform ?? "—"}</td>
                    <td className="px-4 py-3 font-bold font-mono text-primary">${(earning.amount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{earning.currency}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {earning.receivedAt ? new Date(earning.receivedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">{earning.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-3 font-bold font-mono text-primary text-lg">${totalEarnings.toFixed(2)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
