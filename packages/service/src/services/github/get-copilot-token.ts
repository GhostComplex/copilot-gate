/**
 * GitHub API: Get Copilot token from OAuth token.
 *
 * Matches copilot-api's services/github/get-copilot-token.ts
 */

import { buildGitHubHeaders, type CachedToken } from "../../lib/api-config";
import { TokenExchangeError } from "../../lib/error";

const GITHUB_API_BASE_URL = "https://api.github.com";
const REFRESH_MARGIN_MS = 60_000; // refresh 60s before expiry

// Token cache: githubToken hash -> { token, expiresAt }
const tokenCache = new Map<string, CachedToken>();

export interface GetCopilotTokenResponse {
  expires_at: number;
  refresh_in: number;
  token: string;
}

/** Hash a token using SHA-256 (CF Workers compatible) */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isTokenValid(
  cached: CachedToken | undefined,
  now: number
): boolean {
  return !!cached && cached.expiresAt > now;
}

/**
 * Exchange GitHub OAuth token for Copilot token.
 * Results are cached until expiry.
 */
export async function getCopilotToken(githubToken: string): Promise<string> {
  const cacheKey = await hashToken(githubToken);
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();

  if (isTokenValid(cached, now)) {
    return cached!.token;
  }

  const response = await fetch(
    `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`,
    {
      headers: buildGitHubHeaders(githubToken),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    const statusCode =
      response.status === 401 || response.status === 403
        ? response.status
        : 500;
    throw new TokenExchangeError(
      `GitHub token exchange failed (${response.status}): ${body}`,
      statusCode
    );
  }

  const data = (await response.json()) as GetCopilotTokenResponse;

  // Cache with buffer (expire 60s early)
  tokenCache.set(cacheKey, {
    token: data.token,
    expiresAt: data.expires_at * 1000 - REFRESH_MARGIN_MS,
  });

  return data.token;
}

// For testing
export function clearTokenCache(): void {
  tokenCache.clear();
}
