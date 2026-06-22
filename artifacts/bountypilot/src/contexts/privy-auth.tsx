import { createContext, useContext, type ReactNode } from "react";
import { PrivyProvider as BasePrivyProvider, usePrivy, useLinkAccount } from "@privy-io/react-auth";
import type { User } from "@privy-io/react-auth";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

const noop = async (..._args: unknown[]) => { /* no-op when Privy disabled */ };
const noopUser = async (..._args: unknown[]): Promise<User> => { throw new Error("Privy not enabled"); };

export interface PrivySafeState {
  enabled: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  authenticated: boolean;
  user: User | null;
  ready: boolean;
  getAccessToken: () => Promise<string | null>;
  unlinkGoogle: (subject: string) => Promise<User>;
  unlinkTwitter: (subject: string) => Promise<User>;
  unlinkDiscord: (subject: string) => Promise<User>;
  unlinkGithub: (subject: string) => Promise<User>;
  linkGoogle: () => Promise<void>;
  linkTwitter: () => Promise<void>;
  linkDiscord: () => Promise<void>;
  linkGithub: () => Promise<void>;
}

const defaultPrivyState: PrivySafeState = {
  enabled: false,
  login: noop,
  logout: noop,
  authenticated: false,
  user: null,
  ready: true,
  getAccessToken: async () => null,
  unlinkGoogle: noopUser,
  unlinkTwitter: noopUser,
  unlinkDiscord: noopUser,
  unlinkGithub: noopUser,
  linkGoogle: noop,
  linkTwitter: noop,
  linkDiscord: noop,
  linkGithub: noop,
};

const PrivySafeContext = createContext<PrivySafeState>(defaultPrivyState);

export function usePrivySafe(): PrivySafeState {
  return useContext(PrivySafeContext);
}

function PrivyBridge({ children }: { children: ReactNode }) {
  const {
    login, logout, authenticated, user, ready, getAccessToken,
    unlinkGoogle, unlinkTwitter, unlinkDiscord, unlinkGithub,
  } = usePrivy();
  const { linkGoogle, linkTwitter, linkDiscord, linkGithub } = useLinkAccount();

  return (
    <PrivySafeContext.Provider
      value={{
        enabled: true,
        login,
        logout,
        authenticated,
        user: user ?? null,
        ready,
        getAccessToken,
        unlinkGoogle,
        unlinkTwitter,
        unlinkDiscord,
        unlinkGithub,
        linkGoogle,
        linkTwitter,
        linkDiscord,
        linkGithub,
      }}
    >
      {children}
    </PrivySafeContext.Provider>
  );
}

export function PrivyProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <PrivySafeContext.Provider value={defaultPrivyState}>
        {children}
      </PrivySafeContext.Provider>
    );
  }

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#c3ff00",
          logo: "/icon.png",
        },
        loginMethods: [
          "email",
          "google",
          "twitter",
          "discord",
          "github",
          "linkedin",
          "apple",
          "telegram",
          "farcaster",
          "tiktok",
          "instagram",
          "spotify",
          "twitch",
          "wallet",
        ],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <PrivyBridge>{children}</PrivyBridge>
    </BasePrivyProvider>
  );
}
