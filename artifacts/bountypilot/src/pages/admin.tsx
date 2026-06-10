import { useState, useEffect } from "react";
import { ShieldCheck, Users, Clock, CheckCircle, XCircle, Star, RefreshCw } from "lucide-react";
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

const API = "/api";

function token() { return localStorage.getItem("bountypilot_token") || ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }; }

export function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [tab, setTab] = useState<"all" | "pending" | "trial" | "beta" | "expired">("pending");

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

  async function approve(userId: number) {
    setActionLoading(userId);
    try {
      await fetch(`${API}/admin/approve/${userId}`, { method: "POST", headers: authHeaders() });
      await loadData();
    } finally { setActionLoading(null); }
  }

  async function promoteβeta(userId: number) {
    setActionLoading(userId);
    try {
      await fetch(`${API}/admin/beta/${userId}`, { method: "POST", headers: authHeaders() });
      await loadData();
    } finally { setActionLoading(null); }
  }

  async function revoke(userId: number) {
    setActionLoading(userId);
    try {
      await fetch(`${API}/admin/revoke/${userId}`, { method: "POST", headers: authHeaders() });
      await loadData();
    } finally { setActionLoading(null); }
  }

  const filtered = users.filter(u => tab === "all" ? true : u.plan === tab);

  const planColor = (plan: string) => ({
    beta: "text-primary bg-primary/10 border-primary/20",
    trial: "text-green-400 bg-green-500/10 border-green-500/20",
    pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    expired: "text-red-400 bg-red-500/10 border-red-500/20",
  }[plan] ?? "text-muted-foreground bg-muted/30 border-border");

  return (
    <div className="space-y-6">
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
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Beta", value: stats.beta, sub: "/ 30 max", color: "text-primary" },
            { label: "Trial", value: stats.trial, sub: "active", color: "text-green-400" },
            { label: "Pending", value: stats.pending, sub: "waitlist", color: "text-yellow-400" },
            { label: "Expired", value: stats.expired, sub: "trials", color: "text-red-400" },
            { label: "Waitlist", value: stats.waitlistSignups, sub: "/ 1000", color: "text-muted-foreground" },
            { label: "Total Users", value: stats.total, sub: "accounts", color: "text-foreground" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-3">
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {(["pending", "trial", "beta", "expired", "all"] as const).map(t => (
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
            <p className="text-sm text-muted-foreground text-center py-8">No users in this category</p>
          )}
          {filtered.map(u => (
            <div key={u.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono font-semibold text-sm">@{u.username}</p>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${planColor(u.plan)}`}>
                      {u.plan}
                    </span>
                    {u.isAdmin && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-primary bg-primary/10 border-primary/20">admin</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                  {u.trialEndsAt && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Trial ends {new Date(u.trialEndsAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {u.plan === "pending" && (
                    <>
                      <button
                        onClick={() => approve(u.id)}
                        disabled={actionLoading === u.id}
                        className="flex items-center gap-1 px-2 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-mono hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-3 h-3" />Approve
                      </button>
                      <button
                        onClick={() => promoteβeta(u.id)}
                        disabled={actionLoading === u.id}
                        className="flex items-center gap-1 px-2 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-xs font-mono hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                      >
                        <Star className="w-3 h-3" />Beta
                      </button>
                    </>
                  )}
                  {(u.plan === "trial" || u.plan === "expired") && !u.isAdmin && (
                    <>
                      <button
                        onClick={() => promoteβeta(u.id)}
                        disabled={actionLoading === u.id}
                        className="flex items-center gap-1 px-2 py-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded text-xs font-mono hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                      >
                        <Star className="w-3 h-3" />Beta
                      </button>
                      {u.plan !== "expired" && (
                        <button
                          onClick={() => revoke(u.id)}
                          disabled={actionLoading === u.id}
                          className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-mono hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" />Revoke
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
