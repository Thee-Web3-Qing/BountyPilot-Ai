import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { initializePendo, identifyPendo, trackPendo } from "@/lib/pendo";

export type Plan = "active" | "free";

interface User {
  id: number;
  email: string;
  username: string;
  plan: Plan;
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
  planStatus: Plan | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "bountypilot_token";
const USER_KEY = "bountypilot_user";
const API_BASE = "/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(false);

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
          plan: "active",
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
          plan: "active",
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
        plan: "active",
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
        plan: "active",
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

  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      login, signup, logout,
      isAuthenticated: !!user && !!token,
      canAccessAI: true,
      isPaid: true,
      isFree: false,
      planStatus: "active",
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
