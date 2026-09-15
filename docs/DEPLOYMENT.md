# Deployment

The delivered app is configured for Sites hosting, which supplies the private authentication gateway, Cloudflare Worker and D1 binding. `.openai/hosting.json` records the Site identity and logical `DB` binding. The source repository is mirrored to GitHub for review and reproducibility.

## Local setup

`npm ci`, `npm run build`, `npm run db:migrate:local`, then `npm run dev`.

The migration helper points Wrangler at `drizzle/` using an ignored generated local config. It tracks applied migrations and can be run again safely. Do not replay SQL manually on a persistent production store.

## Hosting requirements

Use the Sites publishing workflow with an exact source commit and built artifact. The hosted gateway must own and validate `oai-authenticated-user-*` headers. No secret API keys are necessary for the core demo. Never publish the development simulator or a raw unauthenticated Worker endpoint.

The supplied Site is owner-private by default. A public GitHub repository or private deployment does not automatically grant judges access to the app. Before a submission, either arrange appropriate Site access or provide the demonstration video and local run instructions. Do not claim a URL is judge-accessible until tested from a separate account/session.

The saved development configuration is not a general multi-tenant production deployment recipe. Additional access roles, retention, backups, rate limits and monitored operation are requirements for a real customer deployment.
