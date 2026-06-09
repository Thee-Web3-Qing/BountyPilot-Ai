import React from "react";
import { Link, useLocation } from "wouter";
import { Crosshair, LayoutDashboard, ListTodo, Plus, Award, Coins, User, Settings2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bounties", label: "All Bounties", icon: ListTodo },
  { href: "/bounties/add", label: "Hunt Bounty", icon: Plus },
  { href: "/submissions", label: "Submissions", icon: Award },
  { href: "/earnings", label: "Earnings", icon: Coins },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center rounded-sm">
            <Crosshair className="w-5 h-5" />
          </div>
          <span className="font-bold font-sans text-xl uppercase tracking-tighter">BountyPilot</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-4 flex flex-col gap-1">
          <div className="px-3 py-2 mb-1">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Signed in as</p>
            <p className="font-mono text-sm font-bold text-foreground truncate">@{user?.username}</p>
          </div>
          <Link href="/profile">
            <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
              location === "/profile" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <User className="w-4 h-4" /> Profile
            </div>
          </Link>
          <Link href="/settings">
            <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors cursor-pointer",
              location === "/settings" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <Settings2 className="w-4 h-4" /> Settings
            </div>
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-sm font-mono text-sm uppercase tracking-wider transition-colors text-muted-foreground hover:bg-red-500/10 hover:text-red-400 w-full text-left"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
