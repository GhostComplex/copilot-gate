#!/usr/bin/env bun

/**
 * copilot-gate - Secure reverse proxy for copilot-api with GitHub OAuth authentication
 *
 * Validates incoming requests using GitHub PAT tokens before proxying to upstream copilot-api.
 */

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  port: number;
  upstream: string;
  allowedUsers: string[];
  cacheTtlMs: number;
  verbose: boolean;
}

function parseAllowedUsers(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((u) => u.trim()).filter(Boolean);
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    port: parseInt(process.env.PORT || "4141"),
    upstream: process.env.UPSTREAM || "http://localhost:4142",
    allowedUsers: parseAllowedUsers(process.env.ALLOWED_USERS),
    cacheTtlMs: parseInt(process.env.CACHE_TTL_MS || "300000"), // 5 minutes
    verbose: process.env.VERBOSE === "true",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--port":
      case "-p":
        config.port = parseInt(args[++i]);
        break;
      case "--upstream":
      case "-u":
        config.upstream = args[++i];
        break;
      case "--allowed-users":
        config.allowedUsers = parseAllowedUsers(args[++i]);
        break;
      case "--verbose":
      case "-v":
        config.verbose = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
copilot-gate - Secure reverse proxy for copilot-api

USAGE:
  copilot-gate [OPTIONS]

OPTIONS:
  -p, --port <PORT>              Port to listen on (default: 4141, env: PORT)
  -u, --upstream <URL>           Upstream copilot-api URL (default: http://localhost:4142, env: UPSTREAM)
      --allowed-users <USERS>    Comma-separated GitHub usernames whitelist (required, env: ALLOWED_USERS)
  -v, --verbose                  Enable verbose logging (env: VERBOSE=true)
  -h, --help                     Show this help message

AUTHENTICATION:
  Clients must send a GitHub token (PAT or gh auth token) in the Authorization header:
    Authorization: Bearer ghp_xxxxx
    Authorization: Bearer gho_xxxxx

  The token is validated against GitHub API to verify the user is in the whitelist.

EXAMPLES:
  # Allow single user
  copilot-gate --allowed-users steins-z

  # Allow multiple users
  copilot-gate --allowed-users steins-z,friend-a,friend-b

  # Using environment variables
  ALLOWED_USERS=steins-z,friend-a UPSTREAM=http://localhost:4142 copilot-gate
`);
}

// ============================================================================
// GitHub Token Verification
// ============================================================================

interface CacheEntry {
  username: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CacheEntry>();

async function verifyGitHubToken(
  token: string,
  allowedUsers: string[],
  cacheTtlMs: number,
  verbose: boolean
): Promise<{ valid: boolean; username?: string; error?: string }> {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    if (verbose) console.log(`[auth] Cache hit for user: ${cached.username}`);
    return {
      valid: allowedUsers.includes(cached.username),
      username: cached.username,
    };
  }

  // Call GitHub API to verify token
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "copilot-gate",
      },
    });

    if (!res.ok) {
      return { valid: false, error: `GitHub API returned ${res.status}` };
    }

    const user = (await res.json()) as { login: string };
    const username = user.login;

    // Cache the result
    tokenCache.set(token, {
      username,
      expiresAt: Date.now() + cacheTtlMs,
    });

    if (verbose) console.log(`[auth] Verified token for user: ${username}`);

    return {
      valid: allowedUsers.includes(username),
      username,
    };
  } catch (err) {
    return { valid: false, error: `GitHub API error: ${err}` };
  }
}

// ============================================================================
// Reverse Proxy
// ============================================================================

async function proxyRequest(
  req: Request,
  upstream: string,
  verbose: boolean
): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = `${upstream}${url.pathname}${url.search}`;

  if (verbose) {
    console.log(`[proxy] ${req.method} ${url.pathname} -> ${targetUrl}`);
  }

  // Clone headers, removing the Authorization header (don't leak client token to upstream)
  const headers = new Headers(req.headers);
  headers.delete("Authorization");
  headers.delete("host");

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      // @ts-ignore - Bun supports duplex
      duplex: "half",
    });

    // Return response with original headers
    return new Response(proxyRes.body, {
      status: proxyRes.status,
      statusText: proxyRes.statusText,
      headers: proxyRes.headers,
    });
  } catch (err) {
    console.error(`[proxy] Error: ${err}`);
    return new Response(JSON.stringify({ error: "Upstream unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// Main Server
// ============================================================================

async function main() {
  const config = parseArgs();

  // Validate allowed users
  if (config.allowedUsers.length === 0) {
    console.error("[error] No allowed users specified. Please set:");
    console.error("  --allowed-users steins-z,friend-a");
    console.error("  or ALLOWED_USERS=steins-z,friend-a");
    process.exit(1);
  }

  console.log(`[init] Allowed users: ${config.allowedUsers.join(", ")}`);
  console.log(`[init] Upstream: ${config.upstream}`);
  console.log(`[init] Starting server on port ${config.port}...`);

  const server = Bun.serve({
    port: config.port,
    async fetch(req) {
      const url = new URL(req.url);

      // Health check endpoint
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Extract token from Authorization header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Missing or invalid Authorization header" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const token = authHeader.slice(7); // Remove "Bearer " prefix

      // Verify token
      const result = await verifyGitHubToken(
        token,
        config.allowedUsers,
        config.cacheTtlMs,
        config.verbose
      );

      if (!result.valid) {
        const message = result.username
          ? `User '${result.username}' is not in the whitelist`
          : result.error || "Invalid token";

        if (config.verbose) {
          console.log(`[auth] Rejected: ${message}`);
        }

        return new Response(JSON.stringify({ error: message }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Proxy the request
      return proxyRequest(req, config.upstream, config.verbose);
    },
  });

  console.log(`[ready] copilot-gate listening on http://localhost:${server.port}`);
}

main();
