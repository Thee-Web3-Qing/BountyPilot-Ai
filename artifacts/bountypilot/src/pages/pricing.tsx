import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useState } from "react";
import { ArrowLeft, Check, Zap, Crown, Star, Loader2 } from "lucide-react";

const TIER = {
  monthly: {
    name: "Monthly",
    price: 5,
    unit: "/month",
    priceId: "price_monthly", // Will be filled from Stripe API
    features: ["All bounties", "AI scoring", "Research briefs", "Production plans"],
  },
  yearly: {
    name: "Yearly",
    price: 45,
    originalPrice: 55,
    unit: "/year",
    badge: "Pre-Launch Deal",
    priceId: "price_yearly",
    features: ["All bounties", "AI scoring", "Research briefs", "Production plans", "Save $10"],
  },
  lifetime: {
    name: "Lifetime",
    price: 250,
    originalPrice: 300,
    unit: " one-time",
    badge: "Best Value",
    priceId: "price_lifetime",
    features: ["All bounties forever", "AI scoring", "Research briefs", "Production plans", "No recurring fees", "All future updates"],
  },
};

export function Pricing() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    if (!token) {
      navigate("/login?redirect=pricing");
      return;
    }
    setLoading(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Checkout failed");
      }
    } catch (e) {
      alert("Checkout error. Try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="font-mono">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 rounded-full px-3 py-1 mb-6">
          <Star className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary uppercase tracking-wider">Pre-Launch Pricing</span>
        </div>

        <h1 className="text-4xl font-bold font-sans uppercase tracking-tighter text-center mb-2">
          Pick Your Plan
        </h1>
        <p className="text-muted-foreground font-mono text-sm text-center mb-10 max-w-lg">
          Lock in launch pricing before we go live. Prices go up at launch.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {/* Monthly */}
          <div className="border border-border rounded-lg p-6 flex flex-col gap-4 bg-card/30 hover:bg-card/50 transition-colors">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="font-sans font-bold text-lg">{TIER.monthly.name}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono">${TIER.monthly.price}</span>
              <span className="text-muted-foreground font-mono text-sm">{TIER.monthly.unit}</span>
            </div>
            <ul className="space-y-2">
              {TIER.monthly.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-sm">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-auto font-mono text-xs uppercase tracking-wider"
              onClick={() => handleCheckout(TIER.monthly.priceId)}
              disabled={!!loading}
            >
              {loading === TIER.monthly.priceId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
            </Button>
          </div>

          {/* Yearly */}
          <div className="border border-primary/40 rounded-lg p-6 flex flex-col gap-4 bg-primary/5 relative">
            <span className="absolute top-3 right-3 text-[10px] font-mono bg-primary text-primary-foreground px-2 py-0.5 rounded uppercase tracking-wider">
              {TIER.yearly.badge}
            </span>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="font-sans font-bold text-lg">{TIER.yearly.name}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono">${TIER.yearly.price}</span>
              <span className="text-muted-foreground font-mono text-sm">{TIER.yearly.unit}</span>
              <span className="text-sm font-mono text-red-400 line-through ml-2">${TIER.yearly.originalPrice}</span>
            </div>
            <ul className="space-y-2">
              {TIER.yearly.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-sm">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-auto font-mono text-xs uppercase tracking-wider"
              onClick={() => handleCheckout(TIER.yearly.priceId)}
              disabled={!!loading}
            >
              {loading === TIER.yearly.priceId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reserve Yearly"}
            </Button>
          </div>

          {/* Lifetime */}
          <div className="border border-yellow-500/30 rounded-lg p-6 flex flex-col gap-4 bg-yellow-500/5 relative">
            <span className="absolute top-3 right-3 text-[10px] font-mono bg-yellow-500 text-black px-2 py-0.5 rounded uppercase tracking-wider">
              {TIER.lifetime.badge}
            </span>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <h3 className="font-sans font-bold text-lg">{TIER.lifetime.name}</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono">${TIER.lifetime.price}</span>
              <span className="text-muted-foreground font-mono text-sm">{TIER.lifetime.unit}</span>
              <span className="text-sm font-mono text-red-400 line-through ml-2">${TIER.lifetime.originalPrice}</span>
            </div>
            <ul className="space-y-2">
              {TIER.lifetime.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-sm">
                  <Check className="w-3.5 h-3.5 text-green-400" /> {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-auto font-mono text-xs uppercase tracking-wider bg-yellow-500 hover:bg-yellow-400 text-black"
              onClick={() => handleCheckout(TIER.lifetime.priceId)}
              disabled={!!loading}
            >
              {loading === TIER.lifetime.priceId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reserve Lifetime"}
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground font-mono text-xs text-center mt-8">
          Secure checkout via Stripe. Cancel anytime. No hidden fees.
        </p>
      </div>
    </div>
  );
}
