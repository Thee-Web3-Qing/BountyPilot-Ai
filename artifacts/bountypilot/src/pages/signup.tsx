import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, AlertCircle, Gift } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleAuth } from "@/contexts/google-auth";

export function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signup, loginGoogle, isLoading } = useAuth();
  const { ready: googleReady } = useGoogleAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const urlRefCode = new URLSearchParams(search).get("ref") ?? "";
  const [refCode, setRefCode] = useState(urlRefCode);

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

  const handleGoogle = async (credential: string) => {
    setError("");
    try {
      await loginGoogle(credential, refCode.trim() || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
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

              {/* Google Sign Up */}
              {googleReady && (
                <>
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={(res) => { if (res.credential) handleGoogle(res.credential); }}
                      onError={() => setError("Google sign-up failed — if you're on the dev preview, this domain may not yet be authorized. Use email/password instead.")}
                      theme="filled_black"
                      shape="rectangular"
                      text="signup_with"
                      width="320"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
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
