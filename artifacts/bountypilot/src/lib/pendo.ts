declare global {
  interface Window {
    pendo?: {
      initialize: (config: Record<string, unknown>) => void;
      identify: (config: Record<string, unknown>) => void;
      track: (eventName: string, metadata?: Record<string, unknown>) => void;
      pageLoad: () => void;
    };
  }
}

export function isPendoReady(): boolean {
  return typeof window !== "undefined" && !!window.pendo;
}

export function initializePendo(userId: string, email: string, plan: string) {
  if (!isPendoReady()) return;
  window.pendo!.initialize({
    visitor: {
      id: userId,
      email,
      plan,
      role: "user",
    },
    account: {
      id: "bountypilot",
      name: "BountyPilot AI",
    },
  });
}

export function identifyPendo(userId: string, email: string, plan: string) {
  if (!isPendoReady()) return;
  window.pendo!.identify({
    visitor: {
      id: userId,
      email,
      plan,
      role: "user",
    },
    account: {
      id: "bountypilot",
      name: "BountyPilot AI",
    },
  });
}

export function trackPendo(event: string, metadata?: Record<string, unknown>) {
  if (!isPendoReady()) return;
  window.pendo!.track(event, metadata);
}

export function trackPageLoad() {
  if (!isPendoReady()) return;
  window.pendo!.pageLoad();
}
