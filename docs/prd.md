# Copilot Shadow PRD

> Turn your GitHub Copilot subscription into your own API endpoint.

## Overview

A **stateless** API proxy that forwards requests to GitHub Copilot. Users authenticate via OAuth Device Flow, get a token, and pass it with every request — no server-side storage.

**Two components:**
- **`copilot-shadow`** — Stateless API proxy (CF Workers)
- **`copilot-shadow auth`** — CLI to obtain OAuth token via Device Flow

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        First Time Setup                      │
│                                                              │
│  $ npx copilot-shadow auth                                  │
│                                                              │
│  → Visit https://github.com/login/device                    │
│  → Enter code: XXXX-XXXX                                    │
│  → Token saved to ~/.copilot-shadow/token                   │
│                                                              │
│  Your OAuth Token: <your_copilot_token>                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        Every Request                         │
│                                                              │
│  Client (Claude Code, etc.)                                 │
│    Authorization: Bearer <your_copilot_token>                   │
│                              │                               │
│                              ▼                               │
│  Copilot Shadow (CF Workers)                                │
│    1. OAuth Token from header                               │
│    2. Exchange for Copilot Token (cached ~30min)            │
│    3. Forward to api.githubcopilot.com                      │
│                              │                               │
│                              ▼                               │
│  GitHub Copilot API                                         │
└─────────────────────────────────────────────────────────────┘
```

## Why Device Flow?

GitHub's `/copilot_internal/v2/token` API **only accepts OAuth tokens**, not Personal Access Tokens (PAT).

| Token Type | Works with Copilot API? |
|------------|------------------------|
| Classic PAT (`ghp_xxx`) | ❌ 404 |
| Fine-grained PAT (`github_pat_xxx`) | ❌ 404 |
| OAuth Token (`ghu_xxx`) | ✅ |
| `gh auth token` (gh CLI's OAuth) | ✅ (but wrong scopes) |

The CLI uses GitHub's official Copilot OAuth App (`Iv1.b507a08c87ecfe98`) with minimal `read:user` scope.

## Project Structure

```
copilot-shadow/
├── packages/
│   ├── service/              # CF Workers API proxy
│   │   ├── src/
│   │   │   ├── index.ts      # Hono app entry
│   │   │   ├── copilot.ts    # Token exchange + headers
│   │   │   ├── handlers.ts   # Route handlers
│   │   │   └── utils.ts      # Helpers
│   │   ├── tests/
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   └── cli/                  # Auth CLI
│       ├── src/
│       │   ├── index.ts      # CLI entry
│       │   └── auth.ts       # Device Flow logic
│       └── package.json
│
├── package.json              # Workspace root
└── docs/
    └── prd.md
```

## Core Features

### Service (`packages/service`)

| Feature | Description |
|---------|-------------|
| **Stateless** | No database, no KV. In-memory cache only. |
| **Multi-tenant** | Anyone can use with their own OAuth token |
| **OpenAI Compatible** | `/v1/chat/completions` endpoint |
| **Anthropic Compatible** | `/v1/messages` endpoint |
| **Streaming** | Full SSE streaming support |
| **Token Caching** | In-memory Copilot token cache (~30min) |

### CLI (`packages/cli`)

| Feature | Description |
|---------|-------------|
| **Device Flow** | `npx copilot-shadow auth` |
| **Token Output** | Prints token to stdout (pipe-friendly) |
| **Optional Save** | `--save` writes to `~/.copilot-shadow/token` |
| **Refresh** | `npx copilot-shadow auth --refresh` |

## API Endpoints

### `POST /v1/chat/completions`

OpenAI Chat Completions format.

```bash
curl https://your-domain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer <your_copilot_token>" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-opus-4.5", "messages": [{"role": "user", "content": "Hello"}]}'
```

### `POST /v1/messages`

Anthropic Messages format.

```bash
curl https://your-domain.workers.dev/v1/messages \
  -H "Authorization: Bearer <your_copilot_token>" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-20250514", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### `GET /v1/models`

Returns available models.

### `GET /health`

Health check.

## CLI Usage

```bash
# First time: get OAuth token
npx copilot-shadow auth
# → Opens browser for GitHub authorization
# → Prints: <your_copilot_token>

# Save token locally
npx copilot-shadow auth --save
# → Saved to ~/.copilot-shadow/token

# Show saved token
npx copilot-shadow token

# Refresh token
npx copilot-shadow auth --refresh
```

## Security

| Aspect | How It's Handled |
|--------|------------------|
| **OAuth Scope** | `read:user` only — minimal permissions |
| **Token Storage** | User's machine (`~/.copilot-shadow/token`) or env var |
| **Server Storage** | None — stateless, in-memory cache only |
| **Transport** | HTTPS enforced by CF Workers |
| **Revocation** | User revokes at github.com/settings/applications |

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Server breach | Nothing to steal — no tokens stored |
| Request interception | HTTPS/TLS |
| Token leak (user side) | User can revoke on GitHub immediately |
| Unauthorized usage | Each user brings own token |

## Deployment

### Cloudflare Workers

```bash
cd packages/service
wrangler deploy
```

No secrets needed. The service is stateless.

## Client Setup

### Claude Code

```json
// .claude/settings.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://copilot-shadow.your-domain.workers.dev",
    "ANTHROPIC_AUTH_TOKEN": "<your_copilot_token>"
  }
}
```

### OpenAI SDK

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://copilot-shadow.your-domain.workers.dev/v1',
  apiKey: '<your_copilot_token>',
});
```

## Milestones

### M0: Core Service (~250 lines) ✅

- [x] Hono app skeleton
- [x] OAuth Token → Copilot Token exchange
- [x] In-memory token cache (30min, refresh 5min early)
- [x] `/v1/chat/completions` passthrough
- [x] `/health` endpoint
- [x] GitHub headers (Editor-Version, etc.)

### M1: Auth CLI (~100 lines)

- [ ] `npx copilot-shadow auth` — Device Flow
- [ ] `--save` flag to persist token
- [ ] `npx copilot-shadow token` — show saved token
- [ ] Monorepo setup (pnpm workspaces)

### M2: Anthropic Format (~100 lines)

- [ ] `/v1/messages` endpoint
- [ ] Anthropic ↔ OpenAI message conversion
- [ ] `/v1/models` endpoint
- [ ] Model name mapping (claude-* → copilot models)

### M3: Polish

- [ ] Error messages & troubleshooting
- [ ] README documentation
- [ ] npm publish (`npx copilot-shadow`)

## Why This Design?

| Choice | Reason |
|--------|--------|
| **Stateless server** | No database to breach, infinitely scalable |
| **CLI for auth** | Token stays on user's machine |
| **Device Flow** | Only way to get OAuth token that works with Copilot |
| **Monorepo** | Share types between CLI and service |
| **No dashboard** | Nothing to manage, nothing to secure |
