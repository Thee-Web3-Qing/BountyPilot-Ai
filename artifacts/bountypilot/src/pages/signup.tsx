import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, AlertCircle, Gift, Wallet } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { usePrivySafe } from "@/contexts/privy-auth";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { identifyPendo, trackPendo } from "@/lib/pendo";

const TOKEN_KEY = "bountypilot_token";
const USER_KEY = "bountypilot_user";

export function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signup, isLoading, refreshUser } = useAuth();
  const { login: privyLogin, authenticated: privyAuthenticated, user: privyUser, getAccessToken, ready: privyReady } = usePrivySafe();
  const [privyLoading, setPrivyLoading] = useState(false);
  const [privyNeedsEmail, setPrivyNeedsEmail] = useState(false);
  const [privyPendingToken, setPrivyPendingToken] = useState<string | null>(null);
  const [privyEmailInput, setPrivyEmailInput] = useState("");
  const [, navigate] = useLocation();
  const search = useSearch();
  const urlRefCode = new URLSearchParams(search).get("ref") ?? "";
  const [refCode, setRefCode] = useState(urlRefCode);

  const finishPrivyExchange = async (accessToken: string, emailOverride?: string) => {
    setPrivyLoading(true);
    try {
      const resp = await fetch("/api/auth/privy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, refCode: refCode.trim() || undefined, emailOverride }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || "Privy sign-in failed");
        return;
      }
      if (data.needsEmailLink) {
        setPrivyPendingToken(accessToken);
        setPrivyNeedsEmail(true);
        return;
      }
      const u = data.user;
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
      await refreshUser();
      identifyPendo(String(u.id), u.email, u.plan);
      trackPendo("UserSignedUpPrivy", { plan: u.plan });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Privy sign-in failed");
    } finally {
      setPrivyLoading(false);
    }
  };

  // After Privy authenticates, exchange for our JWT
  useEffect(() => {
    if (!privyAuthenticated || !privyUser) return;
    getAccessToken().then((t) => { if (t) finishPrivyExchange(t); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyAuthenticated, privyUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    try {
      await signup(email, username, password, refCode.trim() || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4 relative">
          <div className="absolute top-0 right-0">
            <NotificationBell />
          </div>
          <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
            <Crosshair className="w-7 h-7" />
          </div>
          <div className="text-center">
            <h1 className="font-bold font-sans text-3xl uppercase tracking-tighter">BountyPilot AI</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">Create your creator workspace</p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Create Account</p>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Email linking prompt — shown when social login has no email */}
              {privyNeedsEmail && (
                <div className="flex flex-col gap-3 border border-primary/30 bg-primary/5 rounded-sm p-4">
                  <p className="font-mono text-xs uppercase tracking-wider text-primary">Link your email</p>
                  <p className="text-sm text-muted-foreground">Your social account didn't share an email. Enter one to link to your existing account or create a new one.</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!privyEmailInput.trim() || !privyPendingToken) return;
                      setPrivyNeedsEmail(false);
                      finishPrivyExchange(privyPendingToken, privyEmailInput.trim());
                    }}
                    className="flex flex-col gap-2"
                  >
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={privyEmailInput}
                      onChange={(e) => setPrivyEmailInput(e.target.value)}
                      className="font-mono text-sm"
                      autoFocus
                      required
                    />
                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1 font-mono uppercase tracking-wider text-xs" disabled={privyLoading}>
                        {privyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
                      </Button>
                      <Button type="button" variant="outline" className="font-mono uppercase tracking-wider text-xs" onClick={() => { setPrivyNeedsEmail(false); setPrivyPendingToken(null); setPrivyEmailInput(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Privy — social login + wallet */}
              {privyReady && !privyNeedsEmail && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-mono uppercase tracking-wider border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-2 justify-center"
                  onClick={() => privyLogin()}
                  disabled={privyLoading}
                >
                  {privyLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Wallet className="w-4 h-4" />}
                  {privyLoading ? "Signing up…" : "Continue with Privy"}
                </Button>
              )}

              {privyReady && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className="font-mono text-sm bg-background" required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Username</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="creatorhandle" className="font-mono text-sm bg-background" required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters" className="font-mono text-sm bg-background" required />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Gift className="w-3 h-3" />
                    Referral Code
                    <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
                  </label>
                  <Input
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value)}
                    placeholder="e.g. qingthecreator"
                    className={`font-mono text-sm bg-background ${refCode ? "border-primary/50 text-primary" : ""}`}
                  />
                  {refCode && (
                    <p className="font-mono text-[10px] text-primary flex items-center gap-1">
                      <Gift className="w-3 h-3" /> Referred by <strong>{refCode}</strong>
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={isLoading} className="font-mono uppercase tracking-wider mt-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Account
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground font-mono text-sm">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-primary hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
}
