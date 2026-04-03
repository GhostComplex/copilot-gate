# Node Service Host

Node.js runtime wrapper around the shared core app. This is the host intended for Docker and Azure Web App deployments.

## Commands

Run from this directory with `pnpm <script>` or from the workspace root with `pnpm dev` and `pnpm start`.

| Script | Description |
|--------|-------------|
| `dev` | Start the local Node development server |
| `build` | Bundle the Node host into `dist/` |
| `start` | Run the built bundle |
| `typecheck` | Run TypeScript checks |
| `lint` | Lint Node host source |
| `lint:fix` | Auto-fix lint issues |
| `format` | Format Node host source |
| `format:check` | Check formatting |

## Local Smoke Test

```bash
pnpm dev
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

## Docker

From the workspace root:

```bash
docker build -t copilot-portal-node-service .
docker run --rm -p 8080:8080 copilot-portal-node-service
curl http://localhost:8080/health
```

## Azure Web App

The repository includes [.github/workflows/deploy-webapp-container.yml](../../.github/workflows/deploy-webapp-container.yml) for Azure Web App for Containers deployments.
