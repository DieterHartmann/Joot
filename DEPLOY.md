# Deployment

## Prerequisites

- Docker + Docker Compose
- Git
- A domain pointing at the server (or Cloudflare Tunnel)

---

## .env

Copy `.env.example` → `.env` and fill in every value:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Postgres password |
| `REDIS_PASSWORD` | Redis password |
| `DATABASE_URL` | `postgresql://joot:<POSTGRES_PASSWORD>@localhost:5432/joot` (host tools only) |
| `REDIS_URL` | `redis://:<REDIS_PASSWORD>@localhost:6379` (host tools only) |
| `BETTER_AUTH_SECRET` | Random secret, min 32 chars — run `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public HTTPS URL, e.g. `https://joot.example.com` |
| `ADMIN_EMAIL` | First admin email (seed only) |
| `ADMIN_PASSWORD` | First admin password (seed only) |
| `ADMIN_NAME` | First admin display name (seed only, optional) |
| `HOLDING_COMPANY_NAME` | Holding company name (seed only, optional, default: Joot Holdings) |
| `SUBSIDIARY_NAME` | First subsidiary name (seed only, optional, default: Main Subsidiary) |

---

## First-time Setup

```bash
git clone https://github.com/DieterHartmann/Joot.git
cd Joot
cp .env.example .env
# edit .env with your values

docker compose build
docker compose up -d

# Run database migration
docker compose --profile tools run --rm -e MIGRATION_NAME=init migrate

# Seed initial data (holding company + admin user)
docker compose --profile tools run --rm seed
```

---

## Standard Deployment (code update)

```bash
bash scripts/deploy.sh
```

This pulls the latest code, rebuilds the api and web images, and restarts them. Postgres and Redis are unaffected.

---

## Schema Migration (when schema.prisma changes)

```bash
docker compose --profile tools run --rm -e MIGRATION_NAME=describe_what_changed migrate
docker compose build api
docker compose up -d api
```

Run this **before** restarting the api whenever a migration is included in the update.

---

## Service Reference

| Service | Internal address | Notes |
|---|---|---|
| postgres | `postgres:5432` | Data volume: `postgres_data` |
| redis | `redis:6379` | Data volume: `redis_data` |
| api | `api:3001` | Fastify, not exposed externally |
| web | `web:3000` | nginx SPA, not exposed externally |
| nginx | `:4000` | Public gateway |

All traffic enters via nginx on port 4000. Point your reverse proxy / Cloudflare tunnel at port 4000.
