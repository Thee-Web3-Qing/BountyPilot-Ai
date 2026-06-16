import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth";
import { Bell, BellDot, CheckCircle, Pin, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Update {
  id: number;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  read?: boolean | null;
}

export function NotificationBell() {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!user && !!token;

  useEffect(() => {
    loadNotifications();
  }, [token, user]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      if (isLoggedIn) {
        const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.updates) {
          setUpdates(data.updates);
          setUnread(data.unread ?? 0);
          setHasNew(data.unread > 0);
        }
      } else {
        const res = await fetch("/api/notifications/public/updates");
        const data = await res.json();
        if (data.updates) {
          setUpdates(data.updates);
          // Anonymous: show new badge if updates exist from last 7 days
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const recent = data.updates.filter((u: Update) => new Date(u.createdAt).getTime() > weekAgo);
          setHasNew(recent.length > 0);
        }
      }
    } catch {}
    setLoading(false);
  }

  async function markRead(id: number) {
    if (!isLoggedIn) return;
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUpdates((prev) => prev.map((u) => u.id === id ? { ...u, read: true } : u));
      setUnread((n) => Math.max(0, n - 1));
    } catch {}
  }

  async function markAllRead() {
    if (!isLoggedIn) return;
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUpdates((prev) => prev.map((u) => ({ ...u, read: true })));
      setUnread(0);
      setHasNew(false);
    } catch {}
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        {hasNew || unread > 0 ? (
          <BellDot className="w-5 h-5" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unread > 0 && (
          <span className="absolute top-0 right-0 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        {hasNew && !isLoggedIn && (
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-card" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-[#0d0d0d] border border-border rounded-sm shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> What's New
            </h3>
            {isLoggedIn && unread > 0 && (
              <button
                onClick={markAllRead}
                className="font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {updates.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <p className="font-mono text-xs text-muted-foreground">No updates yet</p>
              </div>
            )}
            {updates.map((u) => (
              <div
                key={u.id}
                className={cn(
                  "px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-white/5 transition-colors",
                  isLoggedIn && u.read === false && "bg-primary/5"
                )}
                onClick={() => markRead(u.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {u.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                      <span className={cn(
                        "font-mono text-xs font-semibold truncate",
                        isLoggedIn && u.read === false ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {u.title}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {u.body}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn(
                        "font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm border",
                        u.category === "feature" && "text-green-400 border-green-500/30 bg-green-500/10",
                        u.category === "fix" && "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
                        u.category === "announcement" && "text-blue-400 border-blue-500/30 bg-blue-500/10",
                        u.category === "update" && "text-primary border-primary/30 bg-primary/10",
                      )}>
                        {u.category}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      {isLoggedIn && u.read === true && (
                        <span className="flex items-center gap-1 font-mono text-[9px] text-green-400">
                          <CheckCircle className="w-3 h-3" /> read
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
