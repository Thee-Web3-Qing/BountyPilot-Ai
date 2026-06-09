import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, AlertCircle } from "lucide-react";

export function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { signup, isLoading } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    try {
      await signup(email, username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Create Account</p>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm font-mono border border-red-400/30 bg-red-400/5 px-3 py-2 rounded-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

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

              <Button type="submit" disabled={isLoading} className="font-mono uppercase tracking-wider mt-1">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Account
              </Button>
            </form>
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
