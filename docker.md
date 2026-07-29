# Docker Documentation � Ciago Technologies

## Overview

The Ciago Technologies platform is deployed to **Cloudflare Workers** (edge runtime). Docker is used **only for local development and CI** � it is not used in production.

### Production Deployment

```
bun run build ? .output/ ? wrangler deploy
```

Cloudflare Workers runs a V8 isolate environment, not a container. Therefore no Dockerfile or Docker Compose is needed for production.

---

## Local Development Stack

For local development, Docker Compose spins up supporting services that mirror the production environment:

| Service  | Image              | Port | Purpose                              |
| -------- | ------------------ | ---- | ------------------------------------ |
| postgres | postgres:16-alpine | 5432 | Local Postgres (mirrors Neon schema) |
| pgadmin  | dpage/pgadmin4     | 5050 | Database admin UI                    |

> **Note:** During the current Supabase phase, these containers are optional. They become required when the Neon migration (plans.md Stage 1) is executed.

---

## docker-compose.yml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ciago
      POSTGRES_PASSWORD: ciago_dev
      POSTGRES_DB: ciago_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d:ro

  pgadmin:
    image: dpage/pgadmin4:latest
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@ciago.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:5050"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

---

## Environment Variables for Local Docker

When using Docker for local Postgres, set the following in `.env.local`:

```env
# Local Docker Postgres
DATABASE_URL=postgresql://ciago:ciago_dev@localhost:5432/ciago_dev
DIRECT_URL=postgresql://ciago:ciago_dev@localhost:5432/ciago_dev
```

---

## Commands

### Start local services

```bash
docker compose up -d
```

### Stop local services

```bash
docker compose down
```

### Stop and remove volumes (full reset)

```bash
docker compose down -v
```

### View logs

```bash
docker compose logs -f postgres
```

### Connect to Postgres directly

```bash
docker exec -it ciago-postgres-1 psql -U ciago -d ciago_dev
```

---

## CI/CD Pipeline

Docker Compose is used in CI (GitHub Actions) to run integration tests against a real Postgres database.

```yaml
# .github/workflows/ci.yml (example)
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: ciago
      POSTGRES_PASSWORD: ciago_test
      POSTGRES_DB: ciago_test
    ports:
      - 5432:5432
```

---

## Production Considerations

| Concern           | Status                                                 |
| ----------------- | ------------------------------------------------------ |
| Container runtime | ? Not used � Cloudflare Workers is containerless       |
| Database          | ? Neon (serverless Postgres) � no Docker needed        |
| Prisma migrations | Uses `DIRECT_URL` (Neon direct connection, not pooler) |
| Edge adapter      | `@prisma/adapter-neon` (after Neon migration)          |
| Wrangler deploy   | `bun run build && wrangler deploy`                     |

---

## Volumes

| Volume        | Purpose                          |
| ------------- | -------------------------------- |
| postgres_data | Persistent Postgres data (local) |

---

## Networks

Default bridge network created by Docker Compose. Services communicate by service name (`postgres`, `pgadmin`).

---

## Missing / Pending Docker Work

- [ ] Create `docker-compose.yml` file in root (currently only documented here)
- [ ] Add `db:start` / `db:stop` scripts to `package.json` after Neon migration
- [ ] Add init SQL scripts for auth schema (`supabase/migrations/`) mount
- [ ] Consider Testcontainers for Vitest integration tests post-Neon migration

---

## Status

| Item                     | Status                                 |
| ------------------------ | -------------------------------------- |
| Production Docker        | ? Not applicable (Cloudflare Workers)  |
| Local dev Docker Compose | ? Documented, file not yet created     |
| CI Docker                | ? Planned for integration tests        |
| Prisma + Docker          | ? Ready after Neon migration (Stage 1) |
