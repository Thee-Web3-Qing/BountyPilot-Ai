import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth";

const API_BASE = "/api";

export function CheckoutSuccess() {
  const [, navigate] = useLocation();
  const { token, refreshUser } = useAuth();
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<"verifying" | "active" | "error">("verifying");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Poll Stripe subscription status
        const res = await fetch(`${API_BASE}/stripe/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!cancelled) {
          if (json.subscription) {
            setStatus("active");
            await refreshUser();
          } else {
            // Wait a moment for webhook to sync
            setTimeout(() => {
              if (!cancelled) {
                setStatus("active");
                refreshUser();
              }
            }, 2000);
          }
        }
      } catch {
        if (!cancelled) {
          setStatus("active");
          refreshUser();
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshUser]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        {checking ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">Verifying Payment...</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Waiting for Stripe to confirm your payment. This usually takes a few seconds.
            </p>
          </>
        ) : status === "active" ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">Payment Confirmed!</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Your subscription is now active. You have full access to all BountyPilot features.
            </p>
            <Button onClick={() => navigate("/")} className="font-mono uppercase tracking-wider">
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold font-sans uppercase tracking-tight text-yellow-400">Almost There</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Your payment was processed, but the confirmation is still syncing. Try refreshing in a few seconds.
            </p>
            <Button onClick={() => navigate("/")} variant="outline" className="font-mono uppercase tracking-wider">
              Go to Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
