# Deployment

The public deployment target is **Firebase Hosting + Cloud Run**, with Firebase Authentication and a dedicated Firestore database. Follow [the single-command Firebase guide](FIREBASE.md).

The Firebase staging step replaces the original Sites authentication and D1 adapters. It builds a standalone Next.js application and never accepts identity headers as authentication.

## Original Sites target

The repository also retains its original Sites/Vinext target for development. Use `npm ci`, `npm run build`, `npm run db:migrate:local`, then `npm run dev`. Open the printed loopback URL and use the local test identity. The Sites gateway owns production identity headers. Never expose the raw Worker or development simulator publicly.

Firebase does not depend on the Sites gateway, D1, or a ChatGPT account. It uses its own verified Firebase sessions, and all inventory stays in the named `lotline` Firestore database. The two deployments do not share stored data.
