import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Crosshair, LayoutDashboard, ListTodo, Plus, Award, Coins,
  User, Settings2, LogOut, Globe, Menu, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Globe },
  { href: "/bounties", label: "My Bounties", icon: ListTodo },
  { href: "/bounties/add", label: "Hunt Bounty", icon: Plus },
  { href: "/submissions", label: "Submissions", icon: Award },
  { href: "/earnings", label: "Earnings", icon: Coins },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  const close = () => {
    setOpen(false);
    setProfileExpanded(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 h-14 border-b border-border bg-card/95 backdrop-blur">
        <Link href="/" onClick={close}>
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded-sm shrink-0">
              <Crosshair className="w-4 h-4" />
            </div>
            <span className="font-bold font-sans text-base uppercase tracking-tighter">BountyPilot</span>
          </div>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
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
            <div className="border-t border-border px-3 py-4 shrink-0">
              {/* Signed in as */}
              <div className="px-4 py-2 mb-1">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Signed in as</p>
                <p className="font-mono text-sm font-bold text-foreground truncate">@{user?.username}</p>
              </div>

              {/* Profile — expands to show Settings + Sign Out */}
              <button
                onClick={() => setProfileExpanded((v) => !v)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors",
                  location === "/profile"
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">Profile</span>
                {profileExpanded
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* Expanded: Settings + Sign Out */}
              {profileExpanded && (
                <div className="mt-0.5 pl-4 flex flex-col gap-0.5">
                  <Link href="/profile" onClick={close}>
                    <div className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
                      location === "/profile"
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}>
                      <User className="w-3.5 h-3.5 shrink-0" />
                      Edit Profile
                    </div>
                  </Link>
                  <Link href="/settings" onClick={close}>
                    <div className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
                      location === "/settings"
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}>
                      <Settings2 className="w-3.5 h-3.5 shrink-0" />
                      Settings
                    </div>
                  </Link>
                  <button
                    onClick={() => { logout(); close(); }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors text-muted-foreground hover:bg-red-500/10 hover:text-red-400 w-full text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 md:px-6 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
