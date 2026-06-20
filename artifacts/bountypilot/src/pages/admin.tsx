import { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, X, Check, Loader2, Clock, ChevronRight, BarChart3, Users, TrendingUp, DollarSign, Hourglass, Award, Target, Flag, Trash2, ExternalLink, AlertTriangle, AlertCircle, Brain, Rocket, Plus, ChevronDown, ChevronUp, Edit2, Lock, Unlock, Star, CreditCard, Search, BellDot, Pin, Send, Coins, ArrowDownCircle, Copy, Sparkles, Twitter, PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { useLocation } from "wouter";

interface AdminUser {
  id: number;
  email: string;
  username: string;
  plan: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  approvedAt: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface AdminPayment {
  id: number;
  depositId: string;
  depositAddress: string;
  tier: string;
  expectedAmount: string;
  txHash: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  username: string;
  email: string;
  userPlan: string;
}

interface Stats {
  beta: number;
  pending: number;
  trial: number;
  expired: number;
  monthly: number;
  yearly: number;
  lifetime: number;
  paid: number;
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
    dau: number;
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

const PLANS = ["monthly", "yearly", "lifetime", "beta", "trial", "expired"] as const;
type Plan = typeof PLANS[number];

const API = "/api";
function token() { return localStorage.getItem("bountypilot_token") || ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }; }

const PLAN_STYLE: Record<string, string> = {
  beta:     "text-primary bg-primary/10 border-primary/30",
  trial:    "text-green-400 bg-green-500/10 border-green-500/30",
  expired:  "text-red-400 bg-red-500/10 border-red-500/30",
  active:   "text-blue-400 bg-blue-500/10 border-blue-500/30",
  lifetime: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  monthly:  "text-blue-400 bg-blue-500/10 border-blue-500/30",
  yearly:   "text-blue-400 bg-blue-500/10 border-blue-500/30",
};

const PLAN_BTN: Record<string, string> = {
  beta:     "border-primary/40 text-primary hover:bg-primary/20 active:bg-primary/30",
  trial:    "border-green-500/40 text-green-400 hover:bg-green-500/20 active:bg-green-500/30",
  expired:  "border-red-500/40 text-red-400 hover:bg-red-500/20 active:bg-red-500/30",
  monthly:  "border-blue-500/40 text-blue-400 hover:bg-blue-500/20 active:bg-blue-500/30",
  yearly:   "border-blue-500/40 text-blue-400 hover:bg-blue-500/20 active:bg-blue-500/30",
  lifetime: "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 active:bg-yellow-500/30",
};

const PLAN_LABEL: Record<string, string> = {
  beta:     "Beta — full access, no expiry",
  trial:    "Trial — 14-day access",
  expired:  "Expired — access revoked",
  monthly:  "Monthly — +31 days paid",
  yearly:   "Yearly — +365 days paid",
  lifetime: "Lifetime — permanent paid",
};

const BLANK_BOUNTY = {
  title: "", description: "", requirements: "", reward: "", rewardToken: "USDC",
  rewardType: "crypto", category: "content", maxParticipants: "", deadline: "", featured: false,
};

interface CustomBounty {
  id: number; title: string; description: string; requirements: string | null;
  reward: string; rewardToken: string; rewardType: string; category: string;
  maxParticipants: number | null; deadline: string | null; featured: boolean;
  status: string; createdAt: string;
}

interface BountyApplication {
  id: number; status: string; submissionNote: string | null; submissionUrl: string | null;
  adminNote: string | null; createdAt: string; userId: number; username: string; email: string;
}

interface AdminCommission {
  id: number;
  referrerId: number;
  referredUserId: number;
  plan: string;
  amount: number;
  status: string;
  createdAt: string;
  referrerUsername: string;
  referrerEmail: string;
  referredUsername: string;
  referredEmail: string;
}

interface AdminPayoutRow {
  id: number;
  userId: number;
  username: string;
  email: string;
  walletAddress: string;
  amount: number;
  currency: string;
  network: string;
  status: string;
  txHash: string | null;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
}

export function Admin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"users" | "report" | "reports" | "launchpad" | "payments" | "updates" | "commissions" | "payouts" | "entries" | "add">("users");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userTab, setUserTab] = useState<"all" | "paid" | Plan>("trial");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [verifying, setVerifying] = useState<number | null>(null);

  const [bountyReports, setBountyReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportAction, setReportAction] = useState<number | null>(null);

  // Launchpad state
  const [launchpadBounties, setLaunchpadBounties] = useState<CustomBounty[]>([]);
  const [loadingLaunchpad, setLoadingLaunchpad] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBounty, setEditingBounty] = useState<CustomBounty | null>(null);
  const [formData, setFormData] = useState({ ...BLANK_BOUNTY });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewingApps, setViewingApps] = useState<CustomBounty | null>(null);
  const [apps, setApps] = useState<BountyApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appAction, setAppAction] = useState<number | null>(null);
  const [expandedApp, setExpandedApp] = useState<number | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState<Record<number, string>>({});

  // Updates state
  const [updates, setUpdates] = useState<any[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [updateForm, setUpdateForm] = useState({ title: "", body: "", category: "update", pinned: false });
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Commissions state
  const [commissions, setCommissions] = useState<AdminCommission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [commissionAction, setCommissionAction] = useState<number | null>(null);

  // Payouts state
  const [adminPayouts, setAdminPayouts] = useState<AdminPayoutRow[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [payoutAction, setPayoutAction] = useState<number | null>(null);
  const [payoutTxInputs, setPayoutTxInputs] = useState<Record<number, string>>({});

  // Entries state
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entryStatusAction, setEntryStatusAction] = useState<number | null>(null);

  // Add Bounty (manual AI extraction) state
  const [addRawText, setAddRawText] = useState("");
  const [addSourceUrl, setAddSourceUrl] = useState("");
  const [addExtracting, setAddExtracting] = useState(false);
  const [addResult, setAddResult] = useState<any | null>(null);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (!(user as any)?.isAdmin) { navigate("/"); return; }
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "reports") loadReports();
    if (activeTab === "launchpad") loadLaunchpad();
    if (activeTab === "payments") loadPayments();
    if (activeTab === "updates") loadUpdates();
    if (activeTab === "commissions") loadCommissions();
    if (activeTab === "payouts") loadPayouts();
    if (activeTab === "entries") loadEntries();
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
      if (r?.error) {
        setReport(null);
        setReportError(r.error);
      } else {
        setReport(r);
        setReportError(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    setPaymentsLoading(true);
    try {
      const res = await fetch(`${API}/admin/payments`, { headers: authHeaders() });
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch { setPayments([]); }
    finally { setPaymentsLoading(false); }
  }

  async function loadUpdates() {
    setLoadingUpdates(true);
    try {
      const res = await fetch(`${API}/admin/updates`, { headers: authHeaders() });
      const data = await res.json();
      setUpdates(Array.isArray(data) ? data : []);
    } catch { setUpdates([]); }
    finally { setLoadingUpdates(false); }
  }

  async function loadCommissions() {
    setLoadingCommissions(true);
    try {
      const res = await fetch(`${API}/admin/commissions`, { headers: authHeaders() });
      const data = await res.json();
      setCommissions(Array.isArray(data) ? data : []);
    } catch { setCommissions([]); }
    finally { setLoadingCommissions(false); }
  }

  async function updateCommissionStatus(id: number, status: "approved" | "rejected") {
    setCommissionAction(id);
    try {
      const res = await fetch(`${API}/admin/commissions/${id}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setCommissions(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      }
    } finally { setCommissionAction(null); }
  }

  async function loadPayouts() {
    setLoadingPayouts(true);
    try {
      const res = await fetch(`${API}/admin/payouts`, { headers: authHeaders() });
      const data = await res.json();
      setAdminPayouts(data.payouts ?? []);
    } catch { setAdminPayouts([]); }
    finally { setLoadingPayouts(false); }
  }

  async function addBountyManual() {
    if (!addRawText.trim()) return;
    setAddExtracting(true);
    setAddError("");
    setAddResult(null);
    try {
      const res = await fetch(`${API}/admin/bounties/manual`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: addRawText, sourceUrl: addSourceUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Extraction failed"); return; }
      setAddResult(data);
      setAddRawText("");
      setAddSourceUrl("");
    } catch { setAddError("Network error — try again."); }
    finally { setAddExtracting(false); }
  }

  async function loadEntries() {
    setLoadingEntries(true);
    try {
      const res = await fetch(`${API}/admin/bounty-entries?bountyId=505`, { headers: authHeaders() });
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch { setEntries([]); }
    finally { setLoadingEntries(false); }
  }

  async function updateEntryStatus(id: number, status: string) {
    setEntryStatusAction(id);
    try {
      const res = await fetch(`${API}/admin/bounty-entries/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    } finally { setEntryStatusAction(null); }
  }

  function exportEntries() {
    const token = localStorage.getItem("auth_token");
    const url = `${API}/admin/bounty-entries/export?bountyId=505`;
    const a = document.createElement("a");
    a.href = url + `&_token=${encodeURIComponent(token ?? "")}`;
    fetch(url, { headers: authHeaders() })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.download = "bounty-entries-505.csv";
        a.click();
        URL.revokeObjectURL(objUrl);
      });
  }

  async function updatePayout(id: number, status: "paid" | "processing" | "failed") {
    setPayoutAction(id);
    try {
      const txHash = payoutTxInputs[id]?.trim() || undefined;
      const res = await fetch(`${API}/admin/payouts/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status, txHash }),
      });
      if (res.ok) {
        setAdminPayouts(prev => prev.map(p =>
          p.id === id ? { ...p, status, txHash: txHash ?? p.txHash, paidAt: status === "paid" ? new Date().toISOString() : p.paidAt } : p
        ));
        setPayoutTxInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    } finally { setPayoutAction(null); }
  }

  async function postUpdate() {
    if (!updateForm.title.trim() || !updateForm.body.trim()) return;
    setPostingUpdate(true);
    try {
      const res = await fetch(`${API}/admin/updates`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify(updateForm),
      });
      if (res.ok) {
        setUpdateForm({ title: "", body: "", category: "update", pinned: false });
        await loadUpdates();
      }
    } catch {}
    setPostingUpdate(false);
  }

  async function deleteUpdate(id: number) {
    if (!confirm("Delete this update?")) return;
    try {
      await fetch(`${API}/admin/updates/${id}`, { method: "DELETE", headers: authHeaders() });
      await loadUpdates();
    } catch {}
  }

  async function verifyPayment(paymentId: number) {
    setVerifying(paymentId);
    try {
      const res = await fetch(`${API}/admin/payments/${paymentId}/verify`, {
        method: "POST", headers: authHeaders(),
      });
      if (res.ok) {
        setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: "COMPLETED" } : p));
        await loadData();
      }
    } finally { setVerifying(null); }
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

  // ── Launchpad helpers ──────────────────────────────────────────────────────
  async function loadLaunchpad() {
    setLoadingLaunchpad(true);
    try {
      const res = await fetch(`${API}/custom-bounties/all`, { headers: authHeaders() });
      const data = await res.json();
      setLaunchpadBounties(Array.isArray(data) ? data : []);
    } catch { setLaunchpadBounties([]); }
    finally { setLoadingLaunchpad(false); }
  }

  function openCreateForm() {
    setEditingBounty(null);
    setFormData({ ...BLANK_BOUNTY });
    setFormError("");
    setShowCreateForm(true);
  }

  function openEditForm(b: CustomBounty) {
    setEditingBounty(b);
    setFormData({
      title: b.title, description: b.description, requirements: b.requirements ?? "",
      reward: b.reward, rewardToken: b.rewardToken, rewardType: b.rewardType,
      category: b.category, maxParticipants: b.maxParticipants ? String(b.maxParticipants) : "",
      deadline: b.deadline ? new Date(b.deadline).toISOString().slice(0, 16) : "",
      featured: b.featured,
    });
    setFormError("");
    setShowCreateForm(true);
  }

  async function saveBounty() {
    if (!formData.title || !formData.description || !formData.reward) {
      setFormError("Title, description, and reward are required"); return;
    }
    setFormSaving(true); setFormError("");
    try {
      const url = editingBounty ? `${API}/custom-bounties/${editingBounty.id}` : `${API}/custom-bounties`;
      const method = editingBounty ? "PUT" : "POST";
      const body = {
        ...formData,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
      };
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setFormError(d.error || "Failed"); return; }
      setShowCreateForm(false);
      await loadLaunchpad();
    } catch { setFormError("Network error"); }
    finally { setFormSaving(false); }
  }

  async function toggleBountyStatus(b: CustomBounty) {
    const newStatus = b.status === "open" ? "closed" : "open";
    await fetch(`${API}/custom-bounties/${b.id}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify({ status: newStatus }),
    });
    await loadLaunchpad();
  }

  async function deleteBounty(id: number) {
    if (!confirm("Delete this bounty permanently?")) return;
    await fetch(`${API}/custom-bounties/${id}`, { method: "DELETE", headers: authHeaders() });
    await loadLaunchpad();
  }

  async function openApps(b: CustomBounty) {
    setViewingApps(b);
    setLoadingApps(true);
    try {
      const res = await fetch(`${API}/custom-bounties/${b.id}/applications`, { headers: authHeaders() });
      const data = await res.json();
      setApps(Array.isArray(data) ? data : []);
      const notes: Record<number, string> = {};
      (Array.isArray(data) ? data : []).forEach((a: BountyApplication) => { notes[a.id] = a.adminNote ?? ""; });
      setAdminNoteInput(notes);
    } catch { setApps([]); }
    finally { setLoadingApps(false); }
  }

  async function updateApp(bountyId: number, appId: number, status: string) {
    setAppAction(appId);
    try {
      await fetch(`${API}/custom-bounties/${bountyId}/applications/${appId}`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ status, adminNote: adminNoteInput[appId] ?? "" }),
      });
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status, adminNote: adminNoteInput[appId] ?? "" } : a));
    } finally { setAppAction(null); }
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

  async function setPlan(userId: number, plan: string) {
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

  const filtered = users.filter(u => {
    const matchesTab = userTab === "all" ? true
      : userTab === "paid" ? (u.plan === "active" || u.plan === "lifetime")
      : u.plan === userTab;
    if (!matchesTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

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
      <div className="flex gap-1 border-b border-border pb-1 overflow-x-auto">
        {[
          { key: "users" as const, label: "Users", icon: Users },
          { key: "payments" as const, label: "Payments", icon: CreditCard },
          { key: "commissions" as const, label: "Commissions", icon: Coins },
          { key: "payouts" as const, label: "Payouts", icon: ArrowDownCircle },
          { key: "report" as const, label: "Report", icon: BarChart3 },
          { key: "reports" as const, label: "Flagged", icon: Flag },
          { key: "launchpad" as const, label: "Launchpad", icon: Rocket },
          { key: "updates" as const, label: "Updates", icon: BellDot },
          { key: "entries" as const, label: "Entries", icon: Send },
          { key: "add" as const, label: "Add Bounty", icon: PlusCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
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
                { label: "Trial",    value: stats.trial,    sub: "active",   color: "text-green-400" },
                { label: "Beta",     value: stats.beta,     sub: "/ 30 max", color: "text-primary" },
                { label: "Monthly",  value: stats.monthly,  sub: "paid",     color: "text-blue-400" },
                { label: "Yearly",   value: stats.yearly,   sub: "paid",     color: "text-blue-300" },
                { label: "Lifetime", value: stats.lifetime, sub: "paid",     color: "text-yellow-400" },
                { label: "Expired",  value: stats.expired,  sub: "ended",    color: "text-red-400" },
                { label: "Total Users", value: stats.total, sub: "accounts", color: "text-foreground" },
                { label: "Paid Total",  value: stats.paid,  sub: "subscribers", color: "text-emerald-400" },
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
            {(["trial", "beta", "paid", "expired", "all"] as const).map(t => (
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

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username or email…"
              className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            />
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
                        Trial ends {new Date(u.trialEndsAt).toLocaleDateString()}
                      </p>
                    )}
                    {u.subscriptionEndsAt && (u.plan === "active") && (
                      <p className="text-[10px] text-blue-400/70 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Sub ends {new Date(u.subscriptionEndsAt).toLocaleDateString()}
                      </p>
                    )}
                    {u.plan === "lifetime" && (
                      <p className="text-[10px] text-yellow-400/70 mt-0.5 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Lifetime access
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

      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Pending Tx Verifications</p>
            <button onClick={loadPayments} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${paymentsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {paymentsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : payments.length === 0 ? (
            <div className="text-center py-14">
              <CreditCard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending payments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">@{p.username}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border capitalize ${
                          p.tier === "lifetime" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                          : "text-blue-400 bg-blue-500/10 border-blue-500/30"
                        }`}>{p.tier}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          p.status === "COMPLETED"
                            ? "text-green-400 bg-green-500/10 border-green-500/30"
                            : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                        }`}>{p.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{p.email}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        Submitted {new Date(p.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-background rounded p-2 space-y-1">
                    <p className="text-[10px] font-mono text-muted-foreground/60 uppercase">Tx Hash</p>
                    <p className="font-mono text-xs text-foreground break-all">{p.txHash}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                    <div>
                      <span className="opacity-50">Expected:</span>{" "}
                      <span className="text-foreground">{p.expectedAmount}</span>
                    </div>
                    <div>
                      <span className="opacity-50">Deposit Addr:</span>{" "}
                      <span className="text-foreground truncate block">{p.depositAddress?.slice(0, 10)}…</span>
                    </div>
                  </div>

                  {p.status !== "COMPLETED" && (
                    <button
                      onClick={() => verifyPayment(p.id)}
                      disabled={verifying === p.id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono font-semibold hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      {verifying === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Verify &amp; Activate
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "report" && (
        <div className="space-y-6">
          {/* AI Insights */}
          <AdminInsights />
          {reportError ? (
            <div className="flex items-center justify-center py-12 text-red-400 text-sm font-mono">
              <AlertCircle className="w-4 h-4 mr-2" />
              {reportError}
            </div>
          ) : !report ? (
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

          {/* All-Time Totals + DAU */}
          <div className="space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">All-Time Totals</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KPICard icon={Users} label="Total Users" value={report.users.total} suffix="" color="text-foreground" />
              <KPICard icon={BarChart3} label="DAU (24h)" value={report.users.dau} suffix="" color="text-orange-400" />
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

      {activeTab === "launchpad" && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {launchpadBounties.length} bounties
            </p>
            <button
              onClick={openCreateForm}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-mono font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Bounty
            </button>
          </div>

          {loadingLaunchpad ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : launchpadBounties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Rocket className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="font-mono text-sm">No bounties yet</p>
              <p className="text-xs mt-1">Create your first custom bounty above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {launchpadBounties.map(b => (
                <div key={b.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            b.status === "open"
                              ? "text-green-400 bg-green-500/10 border-green-500/30"
                              : "text-muted-foreground bg-muted border-border"
                          }`}>
                            {b.status}
                          </span>
                          {b.featured && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-yellow-400 bg-yellow-500/10 border-yellow-500/30">
                              featured
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground/60">{b.category}</span>
                        </div>
                        <p className="font-mono font-semibold text-sm">{b.title}</p>
                        <p className="text-xs text-primary font-mono mt-0.5">
                          {b.reward} {b.rewardToken}
                          {b.maxParticipants && <span className="text-muted-foreground"> · max {b.maxParticipants}</span>}
                          {b.deadline && <span className="text-muted-foreground"> · due {new Date(b.deadline).toLocaleDateString()}</span>}
                        </p>
                      </div>
                    </div>
                    {/* Action row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openApps(b)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Users className="w-3 h-3" /> Applications
                      </button>
                      <button
                        onClick={() => openEditForm(b)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => toggleBountyStatus(b)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border transition-colors ${
                          b.status === "open"
                            ? "border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                            : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                        }`}
                      >
                        {b.status === "open" ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {b.status === "open" ? "Close" : "Reopen"}
                      </button>
                      <button
                        onClick={() => deleteBounty(b.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create / Edit form modal */}
          {showCreateForm && (
            <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowCreateForm(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div
                className="relative w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono font-bold text-sm">{editingBounty ? "Edit Bounty" : "New Bounty"}</p>
                  <button onClick={() => setShowCreateForm(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Title */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Title *</label>
                    <input
                      value={formData.title}
                      onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Create a Tweet thread about BountyPilot"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      placeholder="What do you want bounty hunters to do?"
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* Requirements */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Requirements</label>
                    <textarea
                      value={formData.requirements}
                      onChange={e => setFormData(p => ({ ...p, requirements: e.target.value }))}
                      placeholder="Specific rules or submission criteria..."
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* Reward row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reward *</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={formData.reward}
                        onChange={e => setFormData(p => ({ ...p, reward: e.target.value }))}
                        placeholder="25"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Token</label>
                      <select
                        value={formData.rewardToken}
                        onChange={e => setFormData(p => ({ ...p, rewardToken: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                      >
                        {["USDC", "USDT", "ETH", "SOL", "BNB"].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Category + Max participants */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                      >
                        {["content", "design", "development", "marketing", "research", "other"].map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Max Participants</label>
                      <input
                        type="number" min="1"
                        value={formData.maxParticipants}
                        onChange={e => setFormData(p => ({ ...p, maxParticipants: e.target.value }))}
                        placeholder="Unlimited"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deadline</label>
                    <input
                      type="datetime-local"
                      value={formData.deadline}
                      onChange={e => setFormData(p => ({ ...p, deadline: e.target.value }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Featured toggle */}
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, featured: !p.featured }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono transition-colors w-full ${
                      formData.featured
                        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Star className={`w-4 h-4 ${formData.featured ? "fill-yellow-400" : ""}`} />
                    {formData.featured ? "Featured (pinned to top)" : "Mark as Featured"}
                  </button>
                </div>

                {formError && (
                  <p className="font-mono text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{formError}</p>
                )}

                <button
                  onClick={saveBounty}
                  disabled={formSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-mono font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingBounty ? "Save Changes" : "Create Bounty"}
                </button>
              </div>
            </div>
          )}

          {/* Applications drawer */}
          {viewingApps && (
            <div className="fixed inset-0 z-50 flex items-end" onClick={() => setViewingApps(null)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <div
                className="relative w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-bold text-sm">{viewingApps.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">Applications ({apps.length})</p>
                  </div>
                  <button onClick={() => setViewingApps(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {loadingApps ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : apps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="font-mono text-sm">No applications yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apps.map(a => {
                      const isExpanded = expandedApp === a.id;
                      return (
                        <div key={a.id} className="bg-background border border-border rounded-lg overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between p-3 text-left"
                            onClick={() => setExpandedApp(isExpanded ? null : a.id)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                                a.status === "approved" ? "text-green-400 bg-green-500/10 border-green-500/30"
                                : a.status === "rejected" ? "text-red-400 bg-red-500/10 border-red-500/30"
                                : "text-muted-foreground border-border"
                              }`}>
                                {a.status}
                              </span>
                              <div className="min-w-0">
                                <p className="font-mono text-sm font-semibold truncate">@{a.username}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{a.email}</p>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground/50 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                              {a.submissionNote && (
                                <div>
                                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Note</p>
                                  <p className="text-xs text-foreground bg-card border border-border/50 rounded p-2">{a.submissionNote}</p>
                                </div>
                              )}
                              {a.submissionUrl && (
                                <div>
                                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Portfolio / URL</p>
                                  <a href={a.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3 shrink-0" />{a.submissionUrl}
                                  </a>
                                </div>
                              )}
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Admin Note</p>
                                <textarea
                                  value={adminNoteInput[a.id] ?? ""}
                                  onChange={e => setAdminNoteInput(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  placeholder="Optional note to the applicant..."
                                  rows={2}
                                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary resize-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateApp(viewingApps.id, a.id, "approved")}
                                  disabled={appAction === a.id || a.status === "approved"}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
                                >
                                  {appAction === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => updateApp(viewingApps.id, a.id, "rejected")}
                                  disabled={appAction === a.id || a.status === "rejected"}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                                >
                                  {appAction === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                  Reject
                                </button>
                                <button
                                  onClick={() => updateApp(viewingApps.id, a.id, "pending")}
                                  disabled={appAction === a.id || a.status === "pending"}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors ml-auto"
                                >
                                  Reset
                                </button>
                              </div>
                              <p className="font-mono text-[10px] text-muted-foreground/50">
                                Applied {new Date(a.createdAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "commissions" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setCommissionStatusFilter(f)}
                className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors ${
                  commissionStatusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={loadCommissions}
              className="ml-auto p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCommissions ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingCommissions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (() => {
            const filtered = commissions.filter(c =>
              commissionStatusFilter === "all" ? true : c.status === commissionStatusFilter
            );
            if (filtered.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <Coins className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-mono text-sm">No {commissionStatusFilter === "all" ? "" : commissionStatusFilter + " "}commissions</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {filtered.map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                            c.status === "approved" ? "text-green-400 bg-green-500/10 border-green-500/30"
                            : c.status === "rejected" ? "text-red-400 bg-red-500/10 border-red-500/30"
                            : c.status === "paid" ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                            : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                          }`}>
                            {c.status}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase">
                            {c.plan}
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground">${c.amount.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="text-foreground font-mono">@{c.referrerUsername}</span>
                          {" "}referred{" "}
                          <span className="text-foreground font-mono">@{c.referredUsername}</span>
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground/60">
                          {new Date(c.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {c.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCommissionStatus(c.id, "approved")}
                          disabled={commissionAction === c.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
                        >
                          {commissionAction === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Approve
                        </button>
                        <button
                          onClick={() => updateCommissionStatus(c.id, "rejected")}
                          disabled={commissionAction === c.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                        >
                          {commissionAction === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          Reject
                        </button>
                      </div>
                    )}
                    {(c.status === "approved" || c.status === "rejected") && (
                      <div className="flex items-center gap-2">
                        {c.status === "approved" && (
                          <button
                            onClick={() => updateCommissionStatus(c.id, "rejected")}
                            disabled={commissionAction === c.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                          >
                            {commissionAction === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            Reject
                          </button>
                        )}
                        {c.status === "rejected" && (
                          <button
                            onClick={() => updateCommissionStatus(c.id, "approved")}
                            disabled={commissionAction === c.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
                          >
                            {commissionAction === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Approve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === "payouts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Payout Requests — send crypto to user wallet, then paste tx hash and mark paid
            </p>
            <button onClick={loadPayouts} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPayouts ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loadingPayouts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : adminPayouts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowDownCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-mono text-sm">No payout requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {adminPayouts.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          p.status === "paid" ? "text-green-400 bg-green-500/10 border-green-500/30"
                          : p.status === "failed" ? "text-red-400 bg-red-500/10 border-red-500/30"
                          : p.status === "processing" ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                          : "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                        }`}>
                          {p.status}
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground">${p.amount.toFixed(2)}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase">
                          {p.currency} · {p.network}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        <span className="text-foreground">@{p.username}</span>
                        {" · "}{p.email}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <p className="font-mono text-[10px] text-primary break-all">{p.walletAddress}</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(p.walletAddress)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Copy wallet address"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      {p.txHash && (
                        <a
                          href={`https://etherscan.io/tx/${p.txHash}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-primary flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Tx: {p.txHash.slice(0, 24)}…
                        </a>
                      )}
                      <p className="font-mono text-[10px] text-muted-foreground/60">
                        Requested: {new Date(p.createdAt).toLocaleString()}
                        {p.paidAt && ` · Paid: ${new Date(p.paidAt).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  {(p.status === "requested" || p.status === "processing") && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Paste tx hash after sending..."
                        value={payoutTxInputs[p.id] ?? ""}
                        onChange={e => setPayoutTxInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => updatePayout(p.id, "processing")}
                          disabled={payoutAction === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors"
                        >
                          {payoutAction === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                          Mark Processing
                        </button>
                        <button
                          onClick={() => updatePayout(p.id, "paid")}
                          disabled={payoutAction === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
                        >
                          {payoutAction === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Mark Paid
                        </button>
                        <button
                          onClick={() => updatePayout(p.id, "failed")}
                          disabled={payoutAction === p.id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                        >
                          {payoutAction === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          Failed
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
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

      {activeTab === "updates" && (
        <div className="space-y-6">
          {/* Post Update Form */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">Post Founder Update</h3>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={updateForm.title}
                  onChange={e => setUpdateForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Title"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                />
                <select
                  value={updateForm.category}
                  onChange={e => setUpdateForm(p => ({ ...p, category: e.target.value }))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                >
                  <option value="update">Update</option>
                  <option value="feature">Feature</option>
                  <option value="fix">Fix</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <textarea
                value={updateForm.body}
                onChange={e => setUpdateForm(p => ({ ...p, body: e.target.value }))}
                placeholder="What's new?"
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={updateForm.pinned} onChange={e => setUpdateForm(p => ({ ...p, pinned: e.target.checked }))} className="accent-primary" />
                  Pin to top
                </label>
                <button
                  onClick={postUpdate}
                  disabled={postingUpdate || !updateForm.title.trim() || !updateForm.body.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-mono font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  {postingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Post Update
                </button>
              </div>
            </div>
          </div>

          {/* Existing Updates */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Published Updates</h3>
            {loadingUpdates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : updates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BellDot className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-mono text-xs">No updates posted yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {updates.map((u) => (
                  <div key={u.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {u.pinned && <Pin className="w-3 h-3 text-primary" />}
                          <span className="font-mono text-xs font-bold text-foreground">{u.title}</span>
                          <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border ${
                            u.category === "feature" ? "text-green-400 border-green-500/30 bg-green-500/10" :
                            u.category === "fix" ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" :
                            u.category === "announcement" ? "text-blue-400 border-blue-500/30 bg-blue-500/10" :
                            "text-primary border-primary/30 bg-primary/10"
                          }`}>{u.category}</span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground mt-1">{u.body}</p>
                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(u.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteUpdate(u.id)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "add" && (
        <div className="space-y-5 max-w-2xl">
          <div>
            <h2 className="font-bold font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Add Bounty via AI Extraction
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground mt-1">
              Paste raw text from a tweet, post, or announcement. Qwen will extract all fields and add it to the Discover feed under the X platform.
            </p>
          </div>

          <div className="space-y-3">
            {/* Raw text */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Bounty Announcement Text <span className="text-red-400">*</span>
              </label>
              <textarea
                value={addRawText}
                onChange={e => setAddRawText(e.target.value)}
                placeholder="Paste the full tweet, post, or announcement here…"
                rows={8}
                className="w-full bg-background border border-input rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Source URL */}
            <div className="space-y-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Twitter className="w-3 h-3 text-sky-400" /> Source URL <span className="font-normal text-muted-foreground">(tweet link, optional)</span>
              </label>
              <input
                value={addSourceUrl}
                onChange={e => setAddSourceUrl(e.target.value)}
                placeholder="https://x.com/user/status/..."
                className="w-full bg-background border border-input rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {addError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <p className="font-mono text-xs">{addError}</p>
              </div>
            )}

            <button
              onClick={addBountyManual}
              disabled={addExtracting || !addRawText.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {addExtracting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting with Qwen…</>
                : <><Sparkles className="w-3.5 h-3.5" /> Extract & Add to Discover</>
              }
            </button>
          </div>

          {/* Result preview */}
          {addResult && (
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Added to Discover — ID #{addResult.bounty.id}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
                {[
                  ["Title", addResult.extracted.title],
                  ["Project", addResult.extracted.projectName],
                  ["Reward", `${addResult.extracted.rewardAmount} ${addResult.extracted.rewardCurrency}`],
                  ["Deadline", addResult.extracted.deadline || "—"],
                  ["Category", addResult.extracted.trackCategory],
                  ["Score", `${addResult.extracted.opportunityScore}/100`],
                  ["Format", addResult.extracted.contentFormat],
                  ["Tags", addResult.extracted.tags],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="text-foreground">{v}</span>
                  </div>
                ))}
              </div>
              {addResult.extracted.scoreExplanation && (
                <p className="font-mono text-[11px] text-muted-foreground italic border-t border-border pt-2">
                  {addResult.extracted.scoreExplanation}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`/bounties/${addResult.bounty.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> View bounty #{addResult.bounty.id}
                </a>
                <button
                  onClick={() => setAddResult(null)}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground ml-auto"
                >
                  + Add another
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "entries" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                $DEGX Contest Entries — {entries.length} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadEntries} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEntries ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={exportEntries}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {loadingEntries ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-mono text-sm">No entries yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry: any) => (
                <div key={entry.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                          entry.status === "winner" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                          : entry.status === "reviewed" ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                          : entry.status === "disqualified" ? "text-red-400 bg-red-500/10 border-red-500/30"
                          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                        }`}>
                          {entry.status}
                        </span>
                        {entry.contentType && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                            {entry.contentType.replace("_", " ")}
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-foreground">@{entry.xHandle}</span>
                        {entry.username && (
                          <span className="font-mono text-[10px] text-muted-foreground">({entry.username})</span>
                        )}
                      </div>
                      <a
                        href={entry.xPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2 block truncate max-w-xs"
                        onClick={e => e.stopPropagation()}
                      >
                        {entry.xPostUrl}
                      </a>
                      {entry.walletAddress && (
                        <p className="font-mono text-[10px] text-muted-foreground truncate max-w-xs">
                          💳 {entry.walletAddress}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="font-mono text-[10px] text-muted-foreground italic">{entry.notes}</p>
                      )}
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {(["submitted", "reviewed", "winner", "disqualified"] as const).map(s => (
                        <button
                          key={s}
                          disabled={entry.status === s || entryStatusAction === entry.id}
                          onClick={() => updateEntryStatus(entry.id, s)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                            entry.status === s
                              ? s === "winner" ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
                                : s === "reviewed" ? "border-blue-500 text-blue-400 bg-blue-500/10"
                                : s === "disqualified" ? "border-red-500 text-red-400 bg-red-500/10"
                                : "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                              : "border-border text-muted-foreground hover:border-foreground/30"
                          }`}
                        >
                          {entryStatusAction === entry.id ? "…" : s}
                        </button>
                      ))}
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
