/**
 * Central API configuration for BountyPilot.
 * When deployed to Vercel, set VITE_API_BASE_URL to the external API server (e.g. Render).
 * In Replit dev, it stays as "/api" (proxied by the Replit environment).
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

/** Build a full API URL from a path. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
