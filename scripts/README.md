# Scripts

This directory contains standalone scripts that are run outside the Next.js request lifecycle. They are excluded from the Next.js production bundle via `tsconfig.json`.

## Usage

All TypeScript scripts require the `DATABASE_URL` environment variable and, for encrypted scripts, the `KEK_DEK_*` keys.

```bash
# Run a script
npx ts-node --project tsconfig.scripts.json scripts/<script-name>.ts

# Or with tsx (faster, no compile step)
npx tsx scripts/<script-name>.ts
```

## Available Scripts

| Script | Purpose | Idempotent |
|--------|---------|------------|
| `analysisWorker.ts` | Standalone worker that processes repository analysis jobs from the queue | No |
| `cronWorker.ts` | Runs scheduled cron jobs (digest emails, repo sync, etc.) | Yes |
| `webhookWorker.ts` | Processes incoming GitHub webhook events from the queue | Yes |
| `workerServer.ts` | Lightweight HTTP server wrapping worker endpoints | No |
| `rotate-dek.ts` | Rotates the Data Encryption Key (DEK) used for envelope encryption | No |
| `encrypt-mfa-secrets.ts` | Re-encrypts existing MFA secrets with the current KEK | No |
| `re-encrypt-all.ts` | Re-encrypts all encrypted tokens/keys in the database | No |
| `kms-init.ts` | Initializes the Key Management Service and stores the master key | No |
| `verify-worker-consistency.ts` | Verifies that worker state matches the database | Yes |
| `test-validation.ts` | Validates test configuration and fixture data | Yes |
| `vercel-build.js` | Custom Vercel build step (JavaScript, not TypeScript) | N/A |

## Adding New Scripts

- Place new scripts in this directory.
- Add them to the table above with a description and idempotency note.
- Ensure `tsconfig.json` excludes this directory from the Next.js bundle.
- Do not include hardcoded secrets, connection strings, or production credentials.
