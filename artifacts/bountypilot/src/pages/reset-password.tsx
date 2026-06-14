import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { API_BASE } from "@/lib/api";

export function ResetPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Reset failed");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setIsLoading(false);
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
            <p className="text-muted-foreground font-mono text-sm mt-1">Your creator revenue autopilot</p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            {success ? (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2 text-green-400 text-sm font-mono border border-green-400/30 bg-green-400/5 px-3 py-2 rounded-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Password reset successfully!
                </div>
                <p className="text-muted-foreground font-mono text-sm">
                  Your password has been updated. You can now log in with your new password.
                </p>
                <Button onClick={() => navigate("/login")} className="font-mono uppercase tracking-wider">
                  Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="flex flex-col gap-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">Reset Password</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="font-mono text-sm bg-background"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Reset Code</label>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono text-sm bg-background tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">New Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="font-mono text-sm bg-background"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="font-mono text-sm bg-background"
                    required
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="font-mono uppercase tracking-wider mt-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Reset Password
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-2 text-muted-foreground font-mono text-sm hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
