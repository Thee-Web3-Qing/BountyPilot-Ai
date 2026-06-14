import { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, X, Check, Loader2, Clock, ChevronRight, BarChart3, Users, TrendingUp, DollarSign, Hourglass, Award, Target, Flag, Trash2, ExternalLink, AlertTriangle, Brain } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  plan: string;
  trialEndsAt: string | null;
  approvedAt: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface Stats {
  beta: number;
  pending: number;
  trial: number;
  expired: number;
  total: number;
}

interface ReportData {
  generatedAt: string;
  users: {
    total: number;
    last24h: number;
    last48h: number;
    last7d: number;
    last30d: number;
    activeLast7d: number;
  };
  bounties: {
    total: number;
    claimed: number;
    won: number;
    lost: number;
    winRate: number;
    last24h: number;
    last48h: number;
    last7d: number;
    last30d: number;
  };
  earnings: {
    total: number;
    last24h: number;
    last48h: number;
    last7d: number;
    last30d: number;
  };
  hoursSaved: {
    total: number;
    last24h: number;
    last48h: number;
    last7d: number;
    last30d: number;
  };
  platformBreakdown: { platform: string; count: number; totalReward: number }[];
  topEarners: { username: string; amount: number }[];
}

const PLANS = ["beta", "trial", "expired"] as const;
type Plan = typeof PLANS[number];

const API = "/api";
function token() { return localStorage.getItem("bountypilot_token") || ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }; }

const PLAN_STYLE: Record<string, string> = {
  beta:    "text-primary bg-primary/10 border-primary/30",
  trial:   "text-green-400 bg-green-500/10 border-green-500/30",
  expired: "text-red-400 bg-red-500/10 border-red-500/30",
};

const PLAN_BTN: Record<string, string> = {
  beta:    "border-primary/40 text-primary hover:bg-primary/20 active:bg-primary/30",
  trial:   "border-green-500/40 text-green-400 hover:bg-green-500/20 active:bg-green-500/30",
  expired: "border-red-500/40 text-red-400 hover:bg-red-500/20 active:bg-red-500/30",
};

const PLAN_LABEL: Record<string, string> = {
  beta:    "Beta — full access, no expiry",
  trial:   "Trial — 14-day access",
  expired: "Expired — access revoked",
};

export function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"users" | "report" | "reports">("users");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userTab, setUserTab] = useState<"all" | Plan>("trial");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [changing, setChanging] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  const [bountyReports, setBountyReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportAction, setReportAction] = useState<number | null>(null);

  useEffect(() => {
    if (!(user as any)?.isAdmin) { navigate("/"); return; }
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "reports") loadReports();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      const [s, u, r] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/admin/users`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/admin/report`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setReport(r);
    } finally {
      setLoading(false);
    }
  }

  async function loadReports() {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API}/admin/bounty-reports`, { headers: authHeaders() });
      const data = await res.json();
      setBountyReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setBountyReports([]);
    } finally {
      setLoadingReports(false);
    }
  }

  async function resolveReport(id: number, resolution: string) {
    setReportAction(id);
    try {
      await fetch(`${API}/admin/bounty-reports/${id}/resolve`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ resolution }),
      });
      await loadReports();
    } finally {
      setReportAction(null);
    }
  }

  async function deleteReport(id: number) {
    setReportAction(id);
    try {
      await fetch(`${API}/admin/bounty-reports/${id}`, { method: "DELETE", headers: authHeaders() });
      await loadReports();
    } finally {
      setReportAction(null);
    }
  }

  async function removeBounty(id: number) {
    if (!confirm("Delete the bounty and all its reports? This cannot be undone.")) return;
    setReportAction(id);
    try {
      await fetch(`${API}/admin/bounty-reports/${id}/remove-bounty`, { method: "DELETE", headers: authHeaders() });
      await loadReports();
    } finally {
      setReportAction(null);
    }
  }

  async function setPlan(userId: number, plan: Plan) {
    setChanging(plan);
    setError("");
    try {
      const res = await fetch(`${API}/admin/set-plan/${userId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); setChanging(null); return; }
      await loadData();
      setSelected(prev => prev ? { ...prev, plan } : null);
    } finally {
      setChanging(null);
    }
  }

  const filtered = users.filter(u => userTab === "all" ? true : u.plan === userTab);

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
        <button onClick={loadData} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Top tabs */}
      <div className="flex gap-1 border-b border-border pb-1">
        {[
          { key: "users" as const, label: "Users", icon: Users },
          { key: "report" as const, label: "Product Report", icon: BarChart3 },
          { key: "reports" as const, label: "Flagged Bounties", icon: Flag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors ${
              activeTab === key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <>
          {stats && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Trial",      value: stats.trial,  sub: "active",   color: "text-green-400" },
                { label: "Beta",       value: stats.beta,   sub: "/ 30 max", color: "text-primary" },
                { label: "Expired",    value: stats.expired,sub: "ended",    color: "text-red-400" },
                { label: "Total Users",value: stats.total,  sub: "accounts", color: "text-foreground" },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-card border border-border rounded-lg p-3">
                  <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1 overflow-x-auto pb-1">
            {(["trial", "beta", "expired", "all"] as const).map(t => (
              <button
                key={t}
                onClick={() => setUserTab(t)}
                className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                  userTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No users in this category</p>
            )}
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => { setSelected(u); setError(""); }}
                className="w-full bg-card border border-border rounded-lg p-4 text-left hover:border-primary/30 active:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-semibold text-sm">@{u.username}</p>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${PLAN_STYLE[u.plan] ?? "text-muted-foreground border-border"}`}>
                        {u.plan}
                      </span>
                      {u.isAdmin && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-primary bg-primary/10 border-primary/20">admin</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                    {u.trialEndsAt && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Ends {new Date(u.trialEndsAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div
                className="relative w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono font-bold text-base">@{selected.username}</p>
                    <p className="text-xs text-muted-foreground">{selected.email}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">Change Tier</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLANS.map(plan => {
                      const isCurrent = selected.plan === plan;
                      const isLoading = changing === plan;
                      return (
                        <button
                          key={plan}
                          onClick={() => !isCurrent && setPlan(selected.id, plan)}
                          disabled={isCurrent || changing !== null}
                          className={`relative flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all disabled:cursor-not-allowed ${
                            isCurrent
                              ? `${PLAN_STYLE[plan]} opacity-100 cursor-default`
                              : `bg-card ${PLAN_BTN[plan]} border-border disabled:opacity-40`
                          }`}
                        >
                          {isCurrent && <Check className="absolute top-2 right-2 w-3 h-3" />}
                          {isLoading && <Loader2 className="absolute top-2 right-2 w-3 h-3 animate-spin" />}
                          <span className="font-mono font-bold text-sm uppercase">{plan}</span>
                          <span className="font-mono text-[10px] opacity-70 leading-tight">{PLAN_LABEL[plan].split("—")[1]?.trim()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="font-mono text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
                )}

                <p className="font-mono text-[10px] text-muted-foreground/50 text-center">
                  Joined {new Date(selected.createdAt).toLocaleDateString()} · ID #{selected.id}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "report" && (
        <div className="space-y-6">
          {/* AI Insights */}
          <AdminInsights />
          {!report ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
          <>
          <p className="text-[10px] font-mono text-muted-foreground/60 text-right">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>

          {/* Key Highlights */}
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Key Highlights (Last 48h)</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={Hourglass} label="Hours Saved" value={report.hoursSaved.last48h} suffix="h" color="text-primary" />
              <KPICard icon={DollarSign} label="Earnings" value={`$${report.earnings.last48h.toLocaleString()}`} suffix="" color="text-green-400" />
              <KPICard icon={Target} label="Opportunities" value={report.bounties.last48h} suffix="" color="text-blue-400" />
              <KPICard icon={Users} label="New Users" value={report.users.last48h} suffix="" color="text-purple-400" />
            </div>
          </div>

          {/* All-Time Totals */}
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">All-Time Totals</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={Users} label="Total Users" value={report.users.total} suffix="" color="text-foreground" />
              <KPICard icon={Target} label="Total Bounties" value={report.bounties.total} suffix="" color="text-foreground" />
              <KPICard icon={DollarSign} label="Total Earnings" value={`$${report.earnings.total.toLocaleString()}`} suffix="" color="text-green-400" />
              <KPICard icon={Hourglass} label="Total Hours Saved" value={report.hoursSaved.total} suffix="h" color="text-primary" />
            </div>
          </div>

          {/* Bounty Performance */}
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Bounty Performance</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={Target} label="Claimed" value={report.bounties.claimed} suffix="" color="text-blue-400" />
              <KPICard icon={Award} label="Won" value={report.bounties.won} suffix="" color="text-green-400" />
              <KPICard icon={X} label="Lost" value={report.bounties.lost} suffix="" color="text-red-400" />
              <KPICard icon={TrendingUp} label="Win Rate" value={`${report.bounties.winRate}%`} suffix="" color="text-primary" />
            </div>
          </div>

          {/* Time Breakdown */}
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Time Breakdown</h2>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">Metric</th>
                    <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">24h</th>
                    <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">48h</th>
                    <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">7d</th>
                    <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">30d</th>
                    <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">All</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-medium">New Users</td>
                    <td className="text-right p-3 font-mono">{report.users.last24h}</td>
                    <td className="text-right p-3 font-mono">{report.users.last48h}</td>
                    <td className="text-right p-3 font-mono">{report.users.last7d}</td>
                    <td className="text-right p-3 font-mono">{report.users.last30d}</td>
                    <td className="text-right p-3 font-mono font-bold">{report.users.total}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-medium">Bounties Added</td>
                    <td className="text-right p-3 font-mono">{report.bounties.last24h}</td>
                    <td className="text-right p-3 font-mono">{report.bounties.last48h}</td>
                    <td className="text-right p-3 font-mono">{report.bounties.last7d}</td>
                    <td className="text-right p-3 font-mono">{report.bounties.last30d}</td>
                    <td className="text-right p-3 font-mono font-bold">{report.bounties.total}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3 font-medium">Earnings ($)</td>
                    <td className="text-right p-3 font-mono">${report.earnings.last24h.toLocaleString()}</td>
                    <td className="text-right p-3 font-mono">${report.earnings.last48h.toLocaleString()}</td>
                    <td className="text-right p-3 font-mono">${report.earnings.last7d.toLocaleString()}</td>
                    <td className="text-right p-3 font-mono">${report.earnings.last30d.toLocaleString()}</td>
                    <td className="text-right p-3 font-mono font-bold">${report.earnings.total.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Hours Saved</td>
                    <td className="text-right p-3 font-mono">{report.hoursSaved.last24h}h</td>
                    <td className="text-right p-3 font-mono">{report.hoursSaved.last48h}h</td>
                    <td className="text-right p-3 font-mono">{report.hoursSaved.last7d}h</td>
                    <td className="text-right p-3 font-mono">{report.hoursSaved.last30d}h</td>
                    <td className="text-right p-3 font-mono font-bold">{report.hoursSaved.total}h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Platform Breakdown */}
          {report.platformBreakdown.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Platform Breakdown</h2>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">Platform</th>
                      <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">Bounties</th>
                      <th className="text-right font-mono text-xs uppercase tracking-wider text-muted-foreground p-3">Total Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.platformBreakdown.map(p => (
                      <tr key={p.platform} className="border-b border-border/50 last:border-0">
                        <td className="p-3 font-medium">{p.platform}</td>
                        <td className="text-right p-3 font-mono">{p.count}</td>
                        <td className="text-right p-3 font-mono">${p.totalReward.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Earners */}
          {report.topEarners.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Top Earners</h2>
              <div className="space-y-2">
                {report.topEarners.map((e, i) => (
                  <div key={e.username} className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-mono text-sm font-semibold">@{e.username}</span>
                    </div>
                    <span className="font-mono text-sm text-green-400">${e.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-4">
          {loadingReports ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : bountyReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-mono text-sm">No open bounty reports</p>
              <p className="text-xs mt-1">Users can flag broken or unverifiable bounties from the bounty detail page.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bountyReports.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/30 uppercase">
                            {r.reason?.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-mono font-semibold text-sm mt-1 truncate">
                          {r.bounty?.title ?? "Unknown Bounty"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Reported by @{r.reportedBy ?? "unknown"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={r.bounty?.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded" title="Open bounty URL">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                    {r.note && (
                      <p className="text-xs text-muted-foreground bg-background/50 rounded p-2 border border-border/50">
                        {r.note}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => resolveReport(r.id, "resolved")}
                        disabled={reportAction === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                      >
                        {reportAction === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Resolve
                      </button>
                      <button
                        onClick={() => deleteReport(r.id)}
                        disabled={reportAction === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        {reportAction === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Dismiss
                      </button>
                      <button
                        onClick={() => removeBounty(r.id)}
                        disabled={reportAction === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 ml-auto"
                      >
                        {reportAction === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete Bounty
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, suffix, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  suffix: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${color}`}>
        {value}{suffix}
      </p>
    </div>
  );
}

function AdminInsights() {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasNovus, setHasNovus] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/insights`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || null);
        setHasNovus(!!data.hasNovus);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  if (!hasNovus) return null;

  return (
    <div className="bg-card border border-primary/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-primary">AI Growth Insights</h3>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-border rounded w-full" />
          <div className="h-3 bg-border rounded w-5/6" />
          <div className="h-3 bg-border rounded w-4/6" />
        </div>
      ) : insights ? (
        <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
          {insights}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground font-mono">No insights available yet.</p>
      )}
    </div>
  );
}
