import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ArrowUpRight, ArrowDownRight, Gift, Coins, Loader2, Info, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: number;
  amount: number;
  reason: string;
  description: string | null;
  createdAt: string;
}

interface StarsData {
  balance: number;
  transactions: Transaction[];
  lastRedeemedAt: string | null;
  nextRedeemAt: string | null;
  canRedeem: boolean;
}

export function StarsDisplay() {
  const { token } = useAuth();
  const [data, setData] = useState<StarsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState("");
  const [redeemStars, setRedeemStars] = useState<string>("50");

  useEffect(() => {
    if (!token) return;
    loadStars();
  }, [token]);

  async function loadStars() {
    try {
      const res = await fetch("/api/checkin/stars", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (!d.error) {
        setData(d);
        // Default to the user's balance or 50
        if (d.balance >= 50) setRedeemStars("50");
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function handleRedeem(mode: "sub" | "cash") {
    if (!token || !data) return;
    const stars = parseInt(redeemStars, 10);
    if (!stars || stars < 50) {
      setRedeemMsg("Minimum 50 stars required");
      return;
    }
    if (stars > data.balance) {
      setRedeemMsg("Not enough stars");
      return;
    }
    setRedeeming(true);
    setRedeemMsg("");
    try {
      const res = await fetch("/api/checkin/stars/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stars, mode }),
      });
      const d = await res.json();
      if (d.ok) {
        setData((prev) => prev ? {
          ...prev,
          balance: d.newBalance,
          lastRedeemedAt: new Date().toISOString(),
          nextRedeemAt: d.nextRedeemAt,
          canRedeem: false,
        } : null);
        const label = mode === "sub" ? "subscription credit" : "cash";
        setRedeemMsg(`Redeemed ${d.starsRedeemed} stars for $${d.dollars} ${label}!`);
      } else if (res.status === 429) {
        setRedeemMsg(d.error || "Redeem cooldown active.");
      } else {
        setRedeemMsg(d.error || "Failed to redeem");
      }
    } catch {
      setRedeemMsg("Failed to redeem");
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const starsNum = parseInt(redeemStars, 10) || 0;
  const subValue = starsNum * 0.1;
  const cashValue = starsNum * 0.02;

  return (
    <div className="flex flex-col gap-4">
      {/* Balance Card */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-sm bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                <Star className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Star Balance</p>
                <p className="font-bold text-3xl font-sans">{data.balance.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> 50 stars = $5 sub
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Cash out: 20% value
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Redeem once per 3 months
              </span>
            </div>
          </div>

          {/* Amount input */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">Stars:</span>
            <input
              type="number"
              min={50}
              max={data.balance}
              value={redeemStars}
              onChange={(e) => setRedeemStars(e.target.value)}
              className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:border-primary"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              Sub: ${subValue.toFixed(2)} | Cash: ${cashValue.toFixed(2)}
            </span>
          </div>

          {/* Cooldown banner */}
          {!data.canRedeem && data.nextRedeemAt && (
            <div className="flex items-center gap-2 font-mono text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Clock className="w-3 h-3" />
              Next redeem available: {new Date(data.nextRedeemAt).toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => handleRedeem("sub")}
              disabled={!data.canRedeem || starsNum < 50 || starsNum > data.balance || redeeming}
              className="flex-1 font-mono text-xs font-bold uppercase tracking-wider h-10"
              variant="outline"
            >
              {redeeming ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Gift className="w-4 h-4 mr-2" />
              )}
              Redeem for Subscription
            </Button>
            <Button
              onClick={() => handleRedeem("cash")}
              disabled={!data.canRedeem || starsNum < 50 || starsNum > data.balance || redeeming}
              className="flex-1 font-mono text-xs font-bold uppercase tracking-wider h-10"
              variant="outline"
            >
              <Coins className="w-4 h-4 mr-2" /> Cash Out
            </Button>
          </div>

          {redeemMsg && (
            <p className={cn(
              "font-mono text-xs text-center",
              redeemMsg.includes("Redeemed") ? "text-green-400" : "text-amber-400"
            )}>
              {redeemMsg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Transaction History</p>
            <span className="font-mono text-[10px] text-muted-foreground">{data.transactions.length} entries</span>
          </div>

          {data.transactions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Star className="w-5 h-5 text-muted-foreground" />
              <p className="font-mono text-xs text-muted-foreground">No transactions yet. Check in daily to earn stars!</p>
            </div>
          )}

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {data.transactions.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-sm border border-border/50 bg-background/50"
              >
                <div className="flex items-center gap-2">
                  {t.amount > 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-green-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <p className="font-mono text-xs font-semibold text-foreground">
                      {t.description || t.reason}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "font-mono text-sm font-bold",
                  t.amount > 0 ? "text-green-400" : "text-red-400"
                )}>
                  {t.amount > 0 ? "+" : ""}{t.amount}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
