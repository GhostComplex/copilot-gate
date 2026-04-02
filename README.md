# Copilot Shadow

Turn your GitHub Copilot subscription into your own API endpoint.

## Quick Start

### 1. Get OAuth Token

```bash
npx copilot-shadow auth
```

This opens GitHub Device Flow — enter the code at github.com/login/device, then you'll get a token like `gho_xxxxxxxxxxxx`.

### 2. Deploy to Cloudflare Workers

```bash
git clone https://github.com/GhostComplex/copilot-shadow
cd copilot-shadow
pnpm install
pnpm deploy
```

### 3. Use It

```bash
curl https://your-worker.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer gho_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'
```

## Client Setup

### Claude Code

Create `.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-worker.workers.dev",
    "ANTHROPIC_AUTH_TOKEN": "gho_xxxxxxxxxxxx"
  }
}
```

### OpenAI SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://your-worker.workers.dev/v1",
  apiKey: "gho_xxxxxxxxxxxx",
});
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI Chat Completions format |
| `POST /v1/messages` | Anthropic Messages format (M2) |
| `GET /v1/models` | List available models (M2) |
| `GET /health` | Health check |

## How It Works

```
You run CLI → Device Flow → OAuth Token (stored locally)
                                ↓
Request with token → Service exchanges for Copilot Token (cached ~30min)
                                ↓
                        GitHub Copilot API
```

**The service is stateless** — your OAuth token stays on your machine, not on the server.

## Security

- **OAuth Token**: Stored on your machine (`~/.copilot-shadow/token` if you use `--save`)
- **Minimal Scope**: Only `read:user` permission
- **Revoke Anytime**: github.com/settings/applications → Revoke "Visual Studio Code"
- **Server Storage**: None — in-memory Copilot Token cache only (cleared on restart)

## Project Structure

```
copilot-shadow/
├── packages/
│   ├── service/     # CF Workers API proxy
│   └── cli/         # OAuth Device Flow CLI
└── docs/
    └── prd.md       # Product Requirements Document
```

## Contributing

### Prerequisites

- Node.js 22+
- pnpm 10+

### Development Setup

```bash
# Clone and install
git clone https://github.com/GhostComplex/copilot-shadow
cd copilot-shadow
pnpm install

# Build CLI
pnpm --filter @copilot-shadow/cli build

# Get OAuth token (one-time)
node packages/cli/dist/index.js auth
# → Save the token somewhere

# Start service dev server
pnpm dev
# → Running at http://localhost:8787

# Test
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer gho_your_token" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}'
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start service dev server |
| `pnpm deploy` | Deploy to Cloudflare Workers |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type check all packages |

### Testing CLI Locally

```bash
# Build
pnpm --filter @copilot-shadow/cli build

# Run
node packages/cli/dist/index.js auth          # Get token
node packages/cli/dist/index.js auth --save   # Get and save token
node packages/cli/dist/index.js token         # Show saved token
```

## License

MIT
