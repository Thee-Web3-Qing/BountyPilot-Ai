import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { initializePendo, identifyPendo, trackPendo } from "@/lib/pendo";

export type Plan = "beta" | "trial" | "expired" | "pending" | "active" | "lifetime";

interface User {
  id: number;
  email: string;
  username: string;
  plan: Plan;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  canAccessAI: boolean;
  isPaid: boolean;
  isFree: boolean;
  trialDaysLeft: number | null;
  planStatus: Plan | null;
  subscriptionEndsAt: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "bountypilot_token";
const USER_KEY = "bountypilot_user";
const API_BASE = "/api";

const HACKATHON_DEADLINE = new Date("2026-08-07T20:00:00Z"); // Aug 7 10pm GMT+1
const GRACE_END = new Date(HACKATHON_DEADLINE.getTime() + 3 * 24 * 60 * 60 * 1000); // Aug 10

// Pre-hackathon users (trialEndsAt == Aug 7) get a 3-day grace period after Aug 7.
function effectiveTrialEnd(user: User | null): Date | null {
  if (!user?.trialEndsAt) return null;
  const endsAt = new Date(user.trialEndsAt);
  const now = new Date();
  if (endsAt.getTime() <= HACKATHON_DEADLINE.getTime() + 60_000 && now > HACKATHON_DEADLINE) {
    return GRACE_END;
  }
  return endsAt;
}

function computePlanStatus(user: User | null): Plan | null {
  if (!user) return null;
  if (user.plan === "beta") return "beta";
  if (user.plan === "active" || user.plan === "lifetime") return "active";
  if (user.plan === "trial" || user.plan === "pending") {
    const effEnd = effectiveTrialEnd(user);
    if (!effEnd) return "trial";
    return effEnd > new Date() ? "trial" : "expired";
  }
  return "expired";
}

function computeTrialDaysLeft(user: User | null): number | null {
  if (!user || user.plan === "beta") return null;
  const effEnd = effectiveTrialEnd(user);
  if (!effEnd) return null;
  const ms = effEnd.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(false);

  // On mount: register auth token getter and silently refresh user from server
  // so that plan / isAdmin fields are always current (handles stale localStorage cache)
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const updated: User = {
          id: data.id,
          email: data.email,
          username: data.username,
          plan: data.plan ?? "trial",
          trialEndsAt: data.trialEndsAt ?? null,
          subscriptionEndsAt: data.subscriptionEndsAt ?? null,
          isAdmin: data.isAdmin ?? false,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        setUser(updated);
        identifyPendo(String(updated.id), updated.email, updated.plan);
        trackPendo("UserRefreshed", { plan: updated.plan });
      })
      .catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    try {
      const resp = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (resp.ok) {
        const data = await resp.json();
        const updated: User = {
          id: data.id,
          email: data.email,
          username: data.username,
          plan: data.plan ?? "trial",
          trialEndsAt: data.trialEndsAt ?? null,
          subscriptionEndsAt: data.subscriptionEndsAt ?? null,
          isAdmin: data.isAdmin ?? false,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        setUser(updated);
      }
    } catch { /* ignore */ }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Login failed");
      }
      const data = await resp.json();
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
        plan: data.user.plan ?? "pending",
        trialEndsAt: data.user.trialEndsAt ?? null,
        subscriptionEndsAt: data.user.subscriptionEndsAt ?? null,
        isAdmin: data.user.isAdmin ?? false,
      };
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
      setToken(data.token);
      setUser(u);
      identifyPendo(String(u.id), u.email, u.plan);
      trackPendo("UserLoggedIn", { plan: u.plan });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Signup failed");
      }
      const data = await resp.json();
      const u: User = {
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
        plan: data.user.plan ?? "pending",
        trialEndsAt: data.user.trialEndsAt ?? null,
        subscriptionEndsAt: data.user.subscriptionEndsAt ?? null,
        isAdmin: data.user.isAdmin ?? false,
      };
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
      setToken(data.token);
      setUser(u);
      identifyPendo(String(u.id), u.email, u.plan);
      trackPendo("UserSignedUp", { plan: u.plan });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(null);
  }, []);

  const planStatus = computePlanStatus(user);
  const trialDaysLeft = computeTrialDaysLeft(user);
  const canAccessAI = planStatus === "beta" || planStatus === "trial" || planStatus === "active";
  const isPaid = planStatus === "active" || planStatus === "beta";
  const isFree = planStatus === "trial" || planStatus === "pending" || planStatus === "expired";

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      login, signup, logout,
      isAuthenticated: !!user && !!token,
      canAccessAI,
      isPaid,
      isFree,
      trialDaysLeft,
      planStatus,
      subscriptionEndsAt: user?.subscriptionEndsAt ?? null,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
