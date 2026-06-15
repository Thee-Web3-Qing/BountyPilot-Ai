import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, AlertCircle, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { API_BASE } from "@/lib/api";

export function LoginOTP() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginOTP } = useAuth();
  const [, navigate] = useLocation();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/login-otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginOTP(email, code);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            {step === "email" ? (
              <form onSubmit={handleRequestCode} className="flex flex-col gap-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">
                    Sign In with Email Code
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="font-mono text-sm bg-background"
                    required
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="font-mono uppercase tracking-wider mt-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Send Login Code
                </Button>

                <div className="text-center space-y-2">
                  <p className="text-muted-foreground font-mono text-sm">
                    Prefer password?{" "}
                    <button onClick={() => navigate("/login")} className="text-primary hover:underline">
                      Sign in with password
                    </button>
                  </p>
                  <p className="text-muted-foreground font-mono text-sm">
                    No account?{" "}
                    <button onClick={() => navigate("/signup")} className="text-primary hover:underline">
                      Create one
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="flex flex-col gap-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">
                    Enter Login Code
                  </p>
                </div>

                <div className="flex items-center gap-2 text-green-400 text-sm font-mono border border-green-400/30 bg-green-400/5 px-3 py-2 rounded-sm">
                  <Mail className="w-4 h-4 shrink-0" />
                  Code sent to {email}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3" /> 6-Digit Code
                  </label>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono text-sm bg-background tracking-widest text-center"
                    maxLength={6}
                    required
                  />
                </div>

                <Button type="submit" className="font-mono uppercase tracking-wider mt-1">
                  Sign In
                </Button>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="flex items-center gap-2 text-muted-foreground font-mono text-sm hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestCode}
                    className="text-muted-foreground font-mono text-sm hover:text-primary transition-colors"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
