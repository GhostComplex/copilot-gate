# Cloudflare Workers Host

Cloudflare-specific runtime wrapper around the shared core app.

## Commands

Run from this directory with `pnpm <script>` or from the workspace root with `pnpm dev:cf` and `pnpm deploy:cf`.

| Script | Description |
|--------|-------------|
| `dev` | Start Wrangler local development server |
| `deploy` | Deploy to Cloudflare Workers |
| `build` | Validate the package with TypeScript |
| `typecheck` | Run TypeScript checks |
| `lint` | Lint Workers host source |
| `lint:fix` | Auto-fix lint issues |
| `format` | Format Workers host source |
| `format:check` | Check formatting |

## Local Smoke Test

```bash
pnpm dev
curl http://localhost:8787/health
```

Expected response:

```json
{"status":"ok"}
```
