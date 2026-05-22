# Joot — Claude Code context

## Project overview

Leave management SaaS. Raspberry Pi runs 6 Docker containers (postgres, redis, api, web, worker, nginx). Publicly accessible at https://joot.hazaa.co.za via Cloudflare Tunnel → nginx on port 4000.

## Monorepo structure

```
packages/db      — Prisma client + helpers (@joot/db)
packages/queue   — BullMQ job factory (@joot/queue)
apps/api         — Fastify API (port 3001 internally)
apps/web         — React SPA (port 3000 internally, nginx-served)
apps/worker      — BullMQ worker + email sender
```

Package manager: **pnpm@9** (pinned — do NOT use corepack or pnpm v10+, breaks Docker builds).

**Fastify version lock: `^4.x`**. All `@fastify/*` plugins must be pinned to versions compatible with Fastify 4.x. `@fastify/multipart` must stay at `^7.x` — v8+ requires Fastify 5.x and will crash at startup.

## Deploying to the Pi

**Always use the deploy script. Never suggest manual docker commands.**

```bash
./scripts/deploy.sh
```

This pulls latest code, rebuilds api/web/worker images, restarts all containers, and reloads nginx. That's it.

## Key Docker build rules

- Every Dockerfile starts with `npm install -g pnpm@9` — pinned, not corepack.
- `pnpm install --ignore-scripts` in deps stage.
- `prisma generate` MUST run before `tsc` / `@joot/db build` in any stage that builds `@joot/db`.
- `pnpm deploy --prod /deploy` creates flat node_modules (no symlinks) for the runner stage.
- After `pnpm deploy`, copy the generated Prisma client from the build store into the deploy store (see api Dockerfile for the `find + rm + cp` pattern).

## Port inventory (Pi — do not reuse)

Taken by other projects: 5000, 5055, 5060, 5001, 5002, 80, 8000, 3000, 3001, 8080.  
Joot: nginx=4000 (public via Cloudflare), postgres=5432 (internal), redis=6379 (internal).  
api and web have **no host port** — only reachable inside Docker network from nginx.

## Auth

- Better Auth 1.6.x. Tables prefixed `Ba` (BaUser, BaSession, BaAccount, BaVerification) — name collision workaround with subsidiary `User` model. A Proxy in `apps/api/src/auth.ts` remaps model access at runtime.
- BA generates nanoid IDs — BA table id columns must be plain `String` (TEXT), NOT `@db.Uuid`.
- `BaUser` → subsidiary `User` link resolved by **email** (canonical identifier). Never key on password or BA id alone.
- `msEntraLinked` + `entraObjectId` are on the `User` model for post-pilot Entra SSO — do not remove them.

## Database

- Prisma with `multiSchema`. Public schema: HoldingCompany, Subsidiary, Ba* auth tables. Subsidiary schema: tenant models.
- Cross-schema FKs (subsidiary_id etc.) are plain UUID fields — NOT Prisma relations. Enforced at app level.
- `tree_path` (UUID-based materialized path) + `tree_path_label` (human-readable). Both must be synced on rename/reparent via `syncTreePath()`.
- `leave_balance.balance` is a stored field — app keeps it in sync on every accrual/approval/recall.

## BullMQ jobs

Worker registers two repeatable crons at startup (BullMQ deduplicates by name+pattern):
- `5 0 1 * *` — monthly accrual (credits `maxDaysPerYear/12` per employee)
- `0 6 * * *` — daily expiry warning (30-day and 7-day thresholds, idempotent)

Manual triggers: `POST /api/accrual/run` and `POST /api/accrual/warn-expiry`.

## Email

Nodemailer via SMTP env vars. All 4 job types send HTML email with plain-text fallback. Templates in `apps/worker/src/templates.ts`.

## Commissioning

`apps/api/src/commissioning/columns.ts` is the **single source of truth** for the XLSX schema. Both `generate.ts` (template) and `parse.ts` (upload parser) import from it. Adding a column definition automatically updates both the template and the parser.

## Reports

- Leave liability: `daily_rate = ctc / 260`, `liability = balance × daily_rate`. BCEA-protected types excluded by default (toggle available).
- Leave transactions: approved leave by month, for HR/payslip systems.
- HR systems pull from Joot REST endpoints — Joot does not push to HR systems.

## Roles

`holding_admin | subsidiary_admin | hr_director | ceo | manager | employee`

## What's NOT in scope (post-pilot only)

- MS Entra SSO (Better Auth OIDC config — no refactor needed when the time comes)
- HR salary import batch endpoint
- Leave calendar / team view
- Stripe / payments — must NOT appear in dependencies
