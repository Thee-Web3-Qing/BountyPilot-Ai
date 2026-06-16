import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Crosshair, LayoutDashboard, ListTodo, Award, Coins,
  User, Settings2, LogOut, Globe, Menu, X, ShieldCheck,
  Rocket, Gift, Crown, Sparkles, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";
import { TrialBanner } from "@/components/trial-banner";
import { NotificationBell } from "@/components/NotificationBell";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Globe },
  { href: "/bounties", label: "My Bounties", icon: ListTodo },
  { href: "/launchpad", label: "Launchpad", icon: Rocket },
  { href: "/submissions", label: "Submissions", icon: Award },
  { href: "/earnings", label: "Earnings", icon: Coins },
  { href: "/referral", label: "Refer & Earn", icon: Gift },
  { href: "/stars", label: "Stars", icon: Sparkles },
  { href: "/agent", label: "Autopilot", icon: Bot },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout, planStatus } = useAuth();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 h-14 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex items-center gap-2">
          {open ? (
            <button
              onClick={close}
              className="flex items-center gap-1.5 p-2 text-foreground hover:text-primary transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
              <span className="font-mono text-xs uppercase tracking-wider font-bold">Close</span>
            </button>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link href="/" onClick={close}>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-sm shrink-0">
                <Crosshair className="w-4 h-4" />
              </div>
              <span className="font-bold font-sans text-base uppercase tracking-tighter">BountyPilot</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Link href="/profile" onClick={close}>
            <div className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Profile">
              <User className="w-5 h-5" />
            </div>
          </Link>
        </div>
      </header>

      {/* ── Drawer overlay ──────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Drawer panel */}
          <div className="relative z-10 w-72 max-w-[85vw] h-full bg-[#0d0d0d] border-r border-border flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
                  <Crosshair className="w-4 h-4" />
                </div>
                <span className="font-bold font-sans text-base uppercase tracking-tighter">BountyPilot</span>
              </div>
              <button
                onClick={close}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex flex-col gap-0.5 px-3 py-5 flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={close}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Account section */}
            <div className="border-t border-border px-3 py-4 shrink-0 flex flex-col gap-0.5">
              {/* Plan badge */}
              <div className="px-4 py-2 mb-1">
                {(planStatus === "expired" || planStatus === "pending") ? (
                  <Link href="/pricing" onClick={close}>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-sm cursor-pointer hover:bg-primary/20 transition-colors">
                      <Sparkles className="w-3 h-3" /> Free Plan — Upgrade
                    </span>
                  </Link>
                ) : planStatus === "trial" ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 rounded-sm">
                    Trial
                  </span>
                ) : planStatus === "active" ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-sm">
                    <Crown className="w-3 h-3" /> Pro
                  </span>
                ) : null}
              </div>

              {user?.isAdmin && (
              <Link href="/settings" onClick={close}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
                  location === "/settings"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}>
                  <Settings2 className="w-4 h-4 shrink-0" />
                  Settings
                </div>
              </Link>
              )}
              {user?.isAdmin && (
                <Link href="/admin" onClick={close}>
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
                    location === "/admin"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Admin
                  </div>
                </Link>
              )}
              <button
                onClick={() => { logout(); close(); }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors text-muted-foreground hover:bg-red-500/10 hover:text-red-400 w-full text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Trial Banner ────────────────────────────────────── */}
      <TrialBanner />

      {/* ── Page content ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto overscroll-y-auto">
        <div className="w-full px-4 py-6 md:px-6 md:py-10 lg:px-8 lg:py-10 max-w-[1440px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
