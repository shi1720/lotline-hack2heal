# Security and data boundaries

## Firebase deployment

- Firebase ID tokens are verified before a five-day, HttpOnly, Secure, SameSite=Lax `__session` cookie is issued. Registered accounts must have signed in within five minutes. Anonymous demo sessions may resume with a fresh token.
- Every protected request verifies the session and checks revocation. Neither query parameters nor legacy Sites identity headers select the account.
- Workspaces are keyed by a SHA-256 digest of the verified account identity and workspace mode. Inventory and demo records are separate; anonymous users cannot access inventory. Only demo data can reset.
- Firestore client rules deny all reads/writes. The dedicated runtime service account has database-scoped access to `lotline` and only the Auth permissions needed for session creation and user lookup. Firestore transactions perform revision-checked writes.
- Auth mutations and stock mutations require the canonical origin. Private responses are not shared-cacheable. Passwords go directly to Firebase Authentication; the Lotline server does not store them.
- The server refuses emulator configuration inside Cloud Run. Local test emulators must remain loopback-only.
- Serialized workspaces are capped at 1.5 MB and compressed Firestore payloads at 900 KB. The state field is exempted from indexing.
- Firebase provides authentication abuse protections. App-specific per-user quotas, organization roles, and operational alerting are not yet implemented.

## Shared protections and original Sites target

- Every workspace/export/FDA API route requires the platform-provided signed-in identity. Every D1 read and update is keyed by that account's stable user ID.
- The Sites gateway owns authentication and must strip untrusted identity headers. The raw Worker and loopback auth simulator are not independent public authentication servers.
- Mutations require same-origin JSON, a valid UUID request key and the current integer revision. D1 updates compare the stored revision atomically, preventing lost updates and duplicate quantity accounting by concurrent writers.
- Request bodies stop at 250,000 bytes, including chunked requests. Domain data are bounded, validated with Zod and stored using prepared statements. CSV is parsed as data, never executed.
- FDA requests use one fixed HTTPS endpoint and a strict recall-number format. No arbitrary URL fetch is implemented. Source URLs are retained links; opening them is a deliberate browser action.
- Export cells neutralize leading spreadsheet formula characters. JSON exports include an SHA-256 digest; event hashes link the event history. These are consistency checks, not independent attestation or cryptographic identity signatures.
- Text renders through React escaping. No HTML injection from source notices or evidence entries.
- Public samples contain only fictional data. No patient information is needed or supported.

## Important limits

Private account scope is not organization authorization. Shared tenants, roles, invitations, backup recovery, formal retention, attachment scanning, external audit anchoring and regulated privacy workflows remain unimplemented. Reset discards the practice history by design after confirmation. Evidence fields are references and attestations, not attachment storage. The app cannot prove physical removal or detect a deliberately false label/receipt entry.

Local integration tests cover unauthenticated requests, origin checks, body limits, invalid payloads and concurrent writes. Firebase emulator tests exercise separate identities and workspace modes. Hosted account tests and penetration testing have separate scopes; see TESTING.md. Do not call this HIPAA compliant, production certified or clinically validated.

Before a real customer pilot: define data-controller responsibilities and legal basis, have qualified staff review workflow scope, use a staging environment, verify tenant isolation with separate real accounts, add organization access and auditable roles, establish backups/restore and retention, add rate limits/monitoring, and conduct a security review. Never expose the development server to a network.
