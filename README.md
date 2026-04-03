# Copilot Portal

Turn your GitHub Copilot subscription into your own API endpoint.

## Quick Start

### 1. Get OAuth Token

```bash
npx copilot-portal auth
```

This opens GitHub Device Flow — enter the code at github.com/login/device, then you'll get a token like `<your_copilot_token>`.

### 2. Deploy

#### Option A. Cloudflare Workers

```bash
git clone https://github.com/GhostComplex/copilot-portal
cd copilot-portal
pnpm install

# Deploy Cloudflare Workers
pnpm deploy:cf
```

#### Option B. Azure Web App (Docker)

Use the included `Dockerfile` with Azure Web App for Containers. The smoothest setup is:

1. Create a Linux Web App and an Azure Container Registry.
2. Configure the Web App health check path as `/health`.
3. Add the required GitHub repository secrets.
4. Run the `Deploy Azure Web App Container` workflow manually.

Required GitHub secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_WEBAPP_NAME`
- `ACR_LOGIN_SERVER`
- `ACR_USERNAME`
- `ACR_PASSWORD`

The workflow builds the image from the repository root, pushes it to ACR, and updates the Web App container image.

### 3. Test It

Replace `YOUR_BASE_URL` with your deployed service URL, for example:

- `https://your-worker.workers.dev`
- `https://your-app.azurewebsites.net`
- `https://api.yourdomain.com`

```bash
curl YOUR_BASE_URL/v1/chat/completions \
  -H "Authorization: Bearer <your_copilot_token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-4.5","messages":[{"role":"user","content":"Hello!"}]}'
```

## Client Setup

### Claude Code

Create `.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "YOUR_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN": "<your_copilot_token>"
  }
}
```

### OpenAI SDK

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "YOUR_BASE_URL/v1",
  apiKey: "<your_copilot_token>",
});
```

## API Endpoints

All endpoints are relative to `YOUR_BASE_URL`.

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI Chat Completions format |
| `POST /v1/messages` | Anthropic Messages format |
| `GET /v1/models` | List available models |
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

- **OAuth Token**: Stored on your machine (`~/.copilot-portal/token` if you use `--save`)
- **Minimal Scope**: Only `read:user` permission
- **Revoke Anytime**: github.com/settings/applications → Revoke "Visual Studio Code"
- **Server Storage**: None — in-memory Copilot Token cache only (cleared on restart)

## Project Structure

```
copilot-portal/
├── packages/
│   ├── core/        # Shared API routes and Copilot proxy logic
│   ├── cf-workers/  # Cloudflare Workers host
│   ├── node-service/ # Node.js host for Azure/App Service
│   └── cli/         # OAuth Device Flow CLI
└── docs/
    └── prd.md       # Product Requirements Document
```

## Development

### Workspace Setup

- Node.js 22+
- pnpm 10+

```bash
git clone https://github.com/GhostComplex/copilot-portal
cd copilot-portal
pnpm install
pnpm build
```

### Workspace Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all workspace packages |
| `pnpm lint` | Lint all packages |
| `pnpm format:check` | Check formatting across packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm test` | Run tests for packages that expose them |
| `pnpm test:coverage` | Run coverage for packages that expose it |
| `pnpm dev` | Start Node service dev server |
| `pnpm dev:cf` | Start Cloudflare Workers dev server |
| `pnpm deploy:cf` | Deploy to Cloudflare Workers |

### Run CLI from local

```bash
cd packages/cli
node dist/index.js --help
```

### Publish CLI to npm

The npm package published from this repo is the CLI package in `packages/cli`.

1. Log in to npm:

```bash
npm login
```

2. Build the CLI package from the workspace root:

```bash
pnpm --filter copilot-portal build
```

3. Optionally inspect the publish contents:

```bash
cd packages/cli
npm pack --dry-run
```

4. Publish the package:

```bash
cd packages/cli
npm publish
```

If npm rejects the publish because the version already exists, bump the version in `packages/cli/package.json` and publish again.

### Package Docs

- [packages/cli/README.md](packages/cli/README.md): npm package usage
- [packages/core/README.md](packages/core/README.md): shared routes, tests, and translation logic
- [packages/cf-workers/README.md](packages/cf-workers/README.md): Cloudflare Workers runtime and deployment
- [packages/node-service/README.md](packages/node-service/README.md): Node runtime, Docker, and Azure Web App notes
- [docs/prd.md](docs/prd.md): product and architecture context

## License

MIT
