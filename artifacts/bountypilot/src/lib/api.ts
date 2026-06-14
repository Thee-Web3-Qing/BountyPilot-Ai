/**
 * Central API configuration for BountyPilot.
 * Replit handles the API routing automatically via artifact router.
 */
export const API_BASE = "/api";

/** Build a full API URL from a path. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
