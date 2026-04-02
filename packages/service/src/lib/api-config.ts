/**
 * API configuration and headers builders.
 *
 * Matches copilot-api's lib/api-config.ts structure.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COPILOT_VERSION = "0.38.2";
const EDITOR_PLUGIN_VERSION = `copilot-chat/${COPILOT_VERSION}`;
const USER_AGENT = `GitHubCopilotChat/${COPILOT_VERSION}`;
const FALLBACK_EDITOR_VERSION = "vscode/1.110.1";
const API_VERSION = "2025-10-01";

const VSCODE_RELEASES_URL =
  "https://update.code.visualstudio.com/api/releases/stable";

const VSCODE_VERSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VSCODE_FALLBACK_TTL_MS = 10 * 60 * 1000; // 10 min

// ---------------------------------------------------------------------------
// VS Code Version (dynamic with 7-day cache, 10min for fallback)
// ---------------------------------------------------------------------------

let cachedVSCodeVersion: string | null = null;
let vscodeVersionExpiresAt = 0;

/** Reset VS Code version cache (for testing) */
export function resetVSCodeVersionCache(): void {
  cachedVSCodeVersion = null;
  vscodeVersionExpiresAt = 0;
}

/** Fetch and cache VS Code version, returns full "vscode/x.y.z" string */
async function fetchVSCodeVersion(): Promise<string> {
  const now = Date.now();
  if (cachedVSCodeVersion && vscodeVersionExpiresAt > now) {
    return cachedVSCodeVersion;
  }

  try {
    const resp = await fetch(VSCODE_RELEASES_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const releases = (await resp.json()) as string[];
    if (
      Array.isArray(releases) &&
      releases.length > 0 &&
      typeof releases[0] === "string"
    ) {
      cachedVSCodeVersion = `vscode/${releases[0]}`;
      vscodeVersionExpiresAt = now + VSCODE_VERSION_TTL_MS;
      return cachedVSCodeVersion;
    }
    throw new Error("Invalid response format");
  } catch (e) {
    console.warn(
      `Failed to fetch VS Code version: ${e instanceof Error ? e.message : String(e)}, using fallback`
    );
    cachedVSCodeVersion = FALLBACK_EDITOR_VERSION;
    vscodeVersionExpiresAt = now + VSCODE_FALLBACK_TTL_MS;
    return cachedVSCodeVersion;
  }
}

// ---------------------------------------------------------------------------
// Headers builders
// ---------------------------------------------------------------------------

export async function buildCopilotHeaders(
  copilotToken: string
): Promise<Record<string, string>> {
  const editorVersion = await fetchVSCodeVersion();
  return {
    Authorization: `Bearer ${copilotToken}`,
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    "Editor-Version": editorVersion,
    "Editor-Plugin-Version": EDITOR_PLUGIN_VERSION,
    "X-GitHub-Api-Version": API_VERSION,
    "Copilot-Integration-Id": "vscode-chat",
    "Openai-Intent": "conversation-panel",
  };
}

export function buildGitHubHeaders(
  githubToken: string
): Record<string, string> {
  // Note: VS Code version is not needed for GitHub API calls in our stateless design
  return {
    Accept: "application/json",
    Authorization: `token ${githubToken}`,
    "User-Agent": USER_AGENT,
    "X-GitHub-Api-Version": API_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedToken {
  token: string;
  expiresAt: number;
}
