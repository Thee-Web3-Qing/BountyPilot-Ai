import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export function CheckoutCancel() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <XCircle className="w-12 h-12 text-yellow-400 mx-auto" />
        <h1 className="text-2xl font-bold font-sans uppercase tracking-tight">Payment Cancelled</h1>
        <p className="text-muted-foreground font-mono text-sm">
          You cancelled the checkout process. No payment was made. You can try again whenever you're ready.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/pricing")} className="font-mono uppercase tracking-wider">
            Back to Pricing
          </Button>
          <Button onClick={() => navigate("/")} variant="outline" className="font-mono uppercase tracking-wider">
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
