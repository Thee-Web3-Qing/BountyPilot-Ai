import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Zap, Settings2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { API_BASE } from "@/lib/api";

interface LLMStatus {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  status: "active" | "mock_mode";
  message: string;
  environment: string;
  supportedProviders: string[];
}

export function Settings() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<LLMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapState, setBootstrapState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [bootstrapMsg, setBootstrapMsg] = useState("");

  async function runBootstrap() {
    setBootstrapState("loading");
    try {
      const res = await fetch(`${API_BASE}/admin/bootstrap`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (data.ok) {
        setBootstrapMsg(data.message || "Bootstrap complete! Sign out and back in to see the Admin panel.");
        setBootstrapState("done");
        await refreshUser();
      } else {
        setBootstrapMsg(data.message || "Already bootstrapped — sign out and back in.");
        setBootstrapState("done");
      }
    } catch {
      setBootstrapMsg("Request failed. Check the API is deployed.");
      setBootstrapState("error");
    }
  }

  useEffect(() => {
    fetch(`${API_BASE}/settings/status`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("bountypilot_token")}` },
    })
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings2 className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold font-sans uppercase tracking-tight">Settings</h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">System configuration and AI provider status</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> Fetching status...
        </div>
      ) : status ? (
        <div className="flex flex-col gap-5">
          <Card className={`border ${status.status === "active" ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
            <CardContent className="p-5 flex items-center gap-4">
              {status.status === "active"
                ? <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                : <Zap className="w-6 h-6 text-yellow-400 shrink-0" />}
              <div>
                <p className={`font-mono font-bold text-sm ${status.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
                  {status.status === "active" ? "AI ACTIVE" : "MOCK MODE"}
                </p>
                <p className="text-muted-foreground font-mono text-xs mt-0.5">{status.message}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6 flex flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-wider text-primary border-b border-border pb-2">Provider Configuration</p>
              <Row label="Current Provider" value={status.provider.toUpperCase()} highlight={status.status === "active"} />
              <Row label="Model" value={status.model} />
              <Row label="API Key" value={status.apiKeyConfigured ? "Configured ✓" : "Not configured"} highlight={status.apiKeyConfigured} warn={!status.apiKeyConfigured} />
              {status.baseUrl && <Row label="Base URL" value={status.baseUrl} mono />}
              <Row label="Environment" value={status.environment.toUpperCase()} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6 flex flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-wider text-primary border-b border-border pb-2">Supported Providers</p>
              <div className="flex gap-3 flex-wrap">
                {status.supportedProviders.map((p) => (
                  <span key={p} className={`font-mono text-xs uppercase px-3 py-1.5 rounded-sm border ${p === status.provider ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
                    {p === status.provider ? "● " : "○ "}{p}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {status.status === "mock_mode" && (
            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="p-5 flex flex-col gap-2">
                <p className="font-mono text-xs uppercase tracking-wider text-yellow-400">Activate AI Mode</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Add <code className="bg-black/30 px-1 py-0.5 rounded">QWEN_API_KEY</code> to your Replit Secrets to enable real AI extraction, scoring, research briefs, and production plans. Get a free key at{" "}
                  <a href="https://dashscope.aliyuncs.com" target="_blank" rel="noopener" className="text-primary hover:underline">dashscope.aliyuncs.com</a>.
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Optional: set <code className="bg-black/30 px-1 py-0.5 rounded">QWEN_MODEL</code> (default: qwen-plus-2025-07-28) and <code className="bg-black/30 px-1 py-0.5 rounded">QWEN_BASE_URL</code>.
                </p>
              </CardContent>
            </Card>
          )}

          {user?.username === "QingTheCreator_" && (
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <p className="font-mono text-xs uppercase tracking-wider text-purple-400">Owner Bootstrap</p>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  Run once to unlock the Admin panel for your account and upgrade all existing users to beta.
                </p>
                {bootstrapMsg && (
                  <p className={`font-mono text-xs px-3 py-2 rounded-sm border ${bootstrapState === "error" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-green-500/30 bg-green-500/10 text-green-400"}`}>
                    {bootstrapMsg}
                  </p>
                )}
                <button
                  onClick={runBootstrap}
                  disabled={bootstrapState === "loading" || bootstrapState === "done"}
                  className="flex items-center gap-2 self-start font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-sm bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bootstrapState === "loading" && <Loader2 className="w-3 h-3 animate-spin" />}
                  {bootstrapState === "loading" ? "Running..." : bootstrapState === "done" ? "Done ✓" : "Activate Admin Access"}
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-red-400 font-mono text-sm">
          <XCircle className="w-4 h-4" /> Failed to load status
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight, warn, mono }: { label: string; value: string; highlight?: boolean; warn?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${highlight ? "text-green-400" : warn ? "text-yellow-400" : "text-foreground"} ${mono ? "text-xs opacity-70" : ""}`}>
        {value}
      </span>
    </div>
  );
}
