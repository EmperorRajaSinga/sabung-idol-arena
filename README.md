# Sabung Idol Arena

Sabung Idol Arena is a tournament management application for idol competitions. It includes league management, Division 2 promotion and relegation, cup competitions, match simulation, career statistics, and historical archives.

## Development

**Requirements:** Node.js 22 or later.

```bash
npm ci
npm run dev
```

Open the local development URL shown in the terminal.

## Verification

```bash
npm run lint
npm test
npm run build
```

## Production deployment

The production application runs on **Cloudflare Workers** and serves the Vite build output from `dist/`.

Deployment configuration lives in `wrangler.jsonc`. The GitHub Actions workflow in `.github/workflows/deploy-cloudflare.yml` builds and deploys the `zip-update` branch.

Configure the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` before enabling automated deployment. The API token needs permission to deploy Workers.
