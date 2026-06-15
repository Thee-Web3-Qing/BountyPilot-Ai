import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";

interface GoogleAuthContextType {
  ready: boolean;
  clientId: string | null;
}

const GoogleAuthContext = createContext<GoogleAuthContextType>({ ready: false, clientId: null });

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/google-client-id")
      .then((r) => r.json())
      .then((d) => { if (d.clientId) setClientId(d.clientId); })
      .catch(() => {});
  }, []);

  if (!clientId) {
    return (
      <GoogleAuthContext.Provider value={{ ready: false, clientId: null }}>
        {children}
      </GoogleAuthContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleAuthContext.Provider value={{ ready: true, clientId }}>
        {children}
      </GoogleAuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}
