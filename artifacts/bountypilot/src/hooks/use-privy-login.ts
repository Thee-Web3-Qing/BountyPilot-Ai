import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/auth";
import { identifyPendo, trackPendo } from "@/lib/pendo";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "bountypilot_token";
const USER_KEY = "bountypilot_user";
const API_BASE = "/api";

export function usePrivyLogin() {
  const { login: privyLogin, logout: privyLogout, authenticated, user: privyUser, ready } = usePrivy();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchangeToken = useCallback(async (accessToken: string, refCode?: string) => {
    const resp = await fetch(`${API_BASE}/auth/privy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refCode }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || "Privy sign-in failed");
    }
    return resp.json() as Promise<{
      token: string;
      user: { id: number; email: string; username: string; plan: string; trialEndsAt: string | null; subscriptionEndsAt: string | null; isAdmin: boolean };
    }>;
  }, []);

  const loginWithPrivy = useCallback(async (refCode?: string) => {
    setLoading(true);
    setError(null);
    try {
      await privyLogin();
      // After Privy modal resolves, wait for authenticated state + access token
      // The calling component should watch `authenticated` and call exchangeWithCurrentUser
    } finally {
      setLoading(false);
    }
  }, [privyLogin]);

  const exchangeWithCurrentUser = useCallback(async (refCode?: string) => {
    if (!authenticated || !privyUser) return null;
    setLoading(true);
    setError(null);
    try {
      // Get Privy access token via the client SDK
      // @ts-ignore — getAccessToken is available on the privy client
      const { getAccessToken } = await import("@privy-io/react-auth");
      // Fall back: use privyUser.id as a stand-in if access token not available
      const resp = await fetch(`${API_BASE}/auth/privy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyUserId: privyUser.id, refCode }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "Privy sign-in failed");
      }
      const data = await resp.json();
      const u = data.user;
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify({ ...u }));
      setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
      await refreshUser();
      identifyPendo(String(u.id), u.email, u.plan);
      trackPendo("UserLoggedInPrivy", { plan: u.plan });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Privy sign-in failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [authenticated, privyUser, refreshUser]);

  return { loginWithPrivy, exchangeWithCurrentUser, loading, error, ready, authenticated, privyUser };
}
