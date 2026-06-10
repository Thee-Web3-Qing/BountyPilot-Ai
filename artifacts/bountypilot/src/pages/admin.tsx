import { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, X, Check, Loader2, Clock, ChevronRight } from "lucide-react";
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
  waitlistSignups: number;
  beta: number;
  pending: number;
  trial: number;
  expired: number;
  total: number;
}

const PLANS = ["beta", "trial", "pending", "expired"] as const;
type Plan = typeof PLANS[number];

const API = "/api";
function token() { return localStorage.getItem("bountypilot_token") || ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }; }

const PLAN_STYLE: Record<string, string> = {
  beta:    "text-primary bg-primary/10 border-primary/30",
  trial:   "text-green-400 bg-green-500/10 border-green-500/30",
  pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  expired: "text-red-400 bg-red-500/10 border-red-500/30",
};

const PLAN_BTN: Record<string, string> = {
  beta:    "border-primary/40 text-primary hover:bg-primary/20 active:bg-primary/30",
  trial:   "border-green-500/40 text-green-400 hover:bg-green-500/20 active:bg-green-500/30",
  pending: "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 active:bg-yellow-500/30",
  expired: "border-red-500/40 text-red-400 hover:bg-red-500/20 active:bg-red-500/30",
};

const PLAN_LABEL: Record<string, string> = {
  beta:    "Beta — full access, no expiry",
  trial:   "Trial — 14-day access",
  pending: "Pending — waitlisted",
  expired: "Expired — access revoked",
};

export function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | Plan>("trial");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [changing, setChanging] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!(user as any)?.isAdmin) { navigate("/"); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/admin/users`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
    } finally {
      setLoading(false);
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

  const filtered = users.filter(u => tab === "all" ? true : u.plan === tab);

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

      {stats && (
        <div className="grid grid-cols-3 gap-2">
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
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
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
    </div>
  );
}
