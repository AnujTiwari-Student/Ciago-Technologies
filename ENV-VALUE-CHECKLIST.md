# Environment Value Checklist

Use this file to collect every value you need to paste into GitHub, Hetzner, Cloudflare, or your server config.

## 1) GitHub Repository Secrets

Paste these in **GitHub → Settings → Secrets and variables → Actions**.

### Branch model
- `development` → dev deployments
- `staging` → staging deployments
- `production-hetzner` → Hetzner production release branch
- `production-cloudflare` → Cloudflare production release branch
- `main` → production workflow trigger branch

| Value name | What to paste | Where to get it |
|---|---|---|
| `DEV_SERVER_IP` | Dev Hetzner server IP | Hetzner console |
| `DEV_SSH_USER` | SSH user name | Your server user |
| `DEV_SSH_PRIVATE_KEY` | Base64-encoded private SSH key | Your local SSH key |
| `DEV_SSH_PORT` | SSH port (usually `22`) | Your server config |
| `DEV_SITE_NAME` | Frappe site name for dev | Your Frappe setup |
| `STAGING_SERVER_IP` | Staging Hetzner server IP | Hetzner console |
| `STAGING_SSH_USER` | SSH user name | Your server user |
| `STAGING_SSH_PRIVATE_KEY` | Base64-encoded private SSH key | Your local SSH key |
| `STAGING_SSH_PORT` | SSH port (usually `22`) | Your server config |
| `STAGING_SITE_NAME` | Frappe site name for staging | Your Frappe setup |
| `PROD_HETZNER_IP` | Production Hetzner server IP | Hetzner console |
| `PROD_SSH_USER` | SSH user name | Your server user |
| `PROD_SSH_PRIVATE_KEY` | Base64-encoded private SSH key | Your local SSH key |
| `PROD_SSH_PORT` | SSH port (usually `22`) | Your server config |
| `PROD_SITE_NAME` | Frappe site name for production | Your Frappe setup |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | Cloudflare dashboard |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Cloudflare dashboard |
| `WRANGLER_AUTH_TOKEN` | Wrangler auth token | Cloudflare / Wrangler login |
| `SLACK_WEBHOOK` | Slack incoming webhook URL | Slack app settings |

## 2) GitHub Environments

Create these in **GitHub → Settings → Environments**:

- `development`
- `staging`
- `production-hetzner`
- `production-cloudflare`

### What to scope where

- `development` → all `DEV_*` secrets
- `staging` → all `STAGING_*` secrets
- `production-hetzner` → all `PROD_*` secrets
- `production-cloudflare` → `CLOUDFLARE_*` secrets

## 3) Server / docker-compose values

Paste these into your Hetzner server `docker-compose.yml` or `.env` file.

| Value name | What to paste | Where to get it |
|---|---|---|
| `FRAPPE_SITE` | Frappe site domain/name | Your Frappe setup |
| `MARIADB_HOST` | MariaDB container/service name | Your compose file |
| `MARIADB_USER` | MariaDB username | Your DB setup |
| `MARIADB_PASSWORD` | MariaDB password | Your DB setup |
| `MYSQL_ROOT_PASSWORD` | MariaDB root password | Your DB setup |
| `MYSQL_DATABASE` | Database name | Your DB setup |

## 4) Not required from you

These are provided automatically by GitHub Actions or the workflow:

- `GITHUB_TOKEN`
- `github.actor`
- `github.repository`

## 5) Quick SSH key paste steps

1. Generate a key pair locally.
2. Copy the public key to the server.
3. Convert the private key to base64.
4. Paste the base64 output into the matching `*_PRIVATE_KEY` secret.

## 6) Values you already have in `.env`

Use these existing values from your repo `.env` file where they match the deployment setup:

| `.env` value | Can be reused for |
|---|---|
| `FRAPPE_SITE_NAME` | `DEV_SITE_NAME`, `STAGING_SITE_NAME`, `PROD_SITE_NAME` if the same site name is used |
| `FRAPPE_DB_PASSWORD` | database password in `docker-compose.yml` / server `.env` |
| `FRAPPE_BASE_URL` | server-side app config or reverse proxy config |
| `DATABASE_URL` / `NEON_DATABASE_URL` | local development or app runtime database config |
| `CLERK_*` / `VITE_CLERK_PUBLISHABLE_KEY` | app runtime auth config |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | app runtime email config |
| `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` | app runtime bot protection config |
| `R2_*` / `VITE_R2_PUBLIC_URL` | app runtime storage config |
| `ORANGEHRM_*` | OrangeHRM integration config |
| `GITHUB_TOKEN` / `GITHUB_ORG` | local tooling only; GitHub Actions already provides `GITHUB_TOKEN` automatically |

If a value already exists in `.env`, copy it only into the place that actually needs it.
