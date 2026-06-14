import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, AlertCircle, CheckCircle, ArrowLeft, Copy } from "lucide-react";
import { API_BASE } from "@/lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [resetCode, setResetCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");

      if (data.code) {
        setResetCode(data.code);
        setUsername(data.username || "");
        setStep("code");
      } else {
        setError("No account found with that email.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(resetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">Forgot Password</p>
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

                <Button type="submit" disabled={isLoading} className="font-mono uppercase tracking-wider mt-1">
                  {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Generate Reset Code
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
            ) : (
              <div className="flex flex-col gap-5">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4">Reset Code Generated</p>
                </div>

                <div className="flex items-center gap-2 text-green-400 text-sm font-mono border border-green-400/30 bg-green-400/5 px-3 py-2 rounded-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Code generated for @{username}
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-sm p-4 text-center">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Your Reset Code</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-3xl font-bold text-primary tracking-widest">{resetCode}</span>
                    <button
                      onClick={copyCode}
                      className="p-1.5 rounded hover:bg-primary/20 transition-colors"
                      title="Copy code"
                    >
                      {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-primary" />}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-2">Expires in 1 hour</p>
                </div>

                <p className="text-sm text-muted-foreground font-mono">
                  Copy this code and go to the reset page to set a new password.
                </p>

                <Button
                  onClick={() => navigate("/reset-password")}
                  className="font-mono uppercase tracking-wider"
                >
                  Go to Reset Page
                </Button>

                <button
                  onClick={() => setStep("email")}
                  className="flex items-center gap-2 text-muted-foreground font-mono text-sm hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Generate Different Code
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
