# Ciago Technologies - CI/CD & Branch Management Guide

## Branch Structure

This repository uses a 4-branch deployment strategy:

### 1. **main** (Primary Development)

- Default branch for feature development
- Receives all feature PRs and bug fixes
- Runs CI checks on every push/PR
- **Does NOT trigger production deployment**

### 2. **development** (Integration Testing)

- Staging branch for development environment
- Merged from `main` via PR
- Runs full CI suite
- Can be deployed to development infrastructure for team testing
- Use: `bun run deploy:dev`

### 3. **staging** (Pre-Production Testing)

- Pre-production branch
- Merged from `development` via PR after testing
- Runs full CI suite
- Should mirror production configuration
- Use: `bun run deploy:staging`

### 4. **production** (Live Environment)

- **ONLY branch that triggers automatic CD deployment to Cloudflare Workers**
- Merged from `staging` via approved PR
- Requires passing CI checks before deployment
- Protected branch - requires review/approval
- **Uses ciagotech.com domain**
- Automatic deployment via GitHub Actions CD workflow

## GitHub Organization vs Personal Account

- **GitHub Organization (Ciago-Technologies)**: Contains `production` branch → Deploys to Cloudflare Workers (ciagotech.com)
- **Personal Account (AnujTiwari-Student)**: Contains all branches for development
- **GitLab Sync**: All branches synced to GitLab organization for mirror/backup

## Deployment Workflow

### Local Development → Production

```
1. Create feature branch from `main`
2. Commit and push to personal GitHub account
3. Create PR to `main`
4. Code review + CI pass
5. Merge to `main`
6. Manually sync main → development (via PR)
7. Test in development environment
8. Sync development → staging (via PR)
9. Test in staging environment (should match production)
10. Create PR: staging → production (on GitHub Organization)
11. Code review on organization
12. CI passes automatically
13. Merge triggers **automatic CD deployment** to Cloudflare Workers
14. App live at ciagotech.com
```

### GitHub Actions CI Workflow

Located in `.github/workflows/ci.yml`

**Runs on:**

- `main`, `development`, `staging`, `production` branches
- All pull requests to these branches

**Checks:**

1. ✅ TypeScript type check (`tsc --noEmit`)
2. ✅ ESLint linting
3. ✅ Unit and integration tests
4. ✅ Full build (Vite + Nitro)
5. ✅ Artifact upload (.output directory)

**Fails CI if:**

- Type errors detected
- Lint violations found
- Tests fail
- Build fails

### GitHub Actions CD Workflow

Located in `.github/workflows/cd.yml`

**Triggers:**

- Only on pushes to `production` branch (automated after PR merge)
- Uses GitHub Environment protection rules for production

**Deployment Steps:**

1. Checkout `production` branch
2. Install dependencies with Bun
3. Build application (Vite + Nitro)
4. Deploy to Cloudflare Workers using Wrangler
5. Creates deployment record in GitHub
6. Notifies on success/failure

**Required Secrets (GitHub Secrets):**

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `WRANGLER_AUTH_TOKEN`: Wrangler CLI authentication token

## Setup Instructions

### 1. Cloudflare Configuration

```bash
# Install wrangler CLI
npm install -g wrangler
# or with bun
bun add -g wrangler

# Authenticate with Cloudflare
wrangler login

# Note your account ID from the dashboard
# Dashboard → Account Home → Right sidebar
```

### 2. Update wrangler.toml

Edit `wrangler.toml` and add:

```toml
account_id = "your-cloudflare-account-id"

[env.production]
routes = [
  { pattern = "ciagotech.com/*", zone_name = "ciagotech.com" }
]
```

### 3. GitHub Organization Setup

Make sure the `production` branch exists in **GitHub Organization (Ciago-Technologies)**:

```bash
git push https://github.com/Ciago-Technologies/Ciago-Technologies.git production
```

### 4. Configure GitHub Secrets

Go to GitHub Organization Settings → Secrets and Variables → Actions:

Add these secrets:

- `CLOUDFLARE_API_TOKEN`: Get from Cloudflare Dashboard → My Profile → API Tokens
- `CLOUDFLARE_ACCOUNT_ID`: Your account ID
- `WRANGLER_AUTH_TOKEN`: Run `wrangler whoami` after login to get auth token

### 5. Configure Branch Protection Rules

On GitHub Organization repository:

**Production branch protection:**

- Require pull request reviews: ✅ (at least 1)
- Require status checks to pass: ✅ (CI workflow)
- Require branches to be up to date: ✅
- Include administrators: ✅

## Local Development

### Build and Test Locally

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run linter
bun run lint

# Build locally (same as CI)
bun run build

# Preview production build
bun run preview
```

### Deploy from Local Machine

```bash
# Deploy to development
bun run deploy:dev

# Deploy to staging
bun run deploy:staging

# Deploy to production (requires auth)
bun run deploy

# Check Wrangler status
wrangler whoami
```

## Troubleshooting

### CI Workflow Failing

1. **Type Errors**: Run `bunx tsc --noEmit` locally and fix
2. **Lint Errors**: Run `bun run lint` and fix with `bun run format`
3. **Test Failures**: Run `bun run test` and check test output
4. **Build Errors**: Run `bun run build` and check for compilation errors

### CD Deployment Failing

1. **Check Cloudflare Credentials**:

   ```bash
   wrangler whoami
   # Should show your Cloudflare account
   ```

2. **Check API Token Permissions**:
   - Must have "Cloudflare Workers" access
   - Must have "Zone" access for ciagotech.com

3. **View GitHub Actions Logs**:
   - Go to GitHub Actions → CD workflow → Latest run → Check logs

4. **Manual Deployment**:
   ```bash
   bun run build
   bun run deploy
   ```

### Domain Configuration

To connect ciagotech.com to Cloudflare Workers:

1. Go to Cloudflare Dashboard → Domains → ciagotech.com
2. Go to Workers & Pages → Workers Routes
3. Add route: `ciagotech.com/*` → `ciagotech-production` worker

## Git Commands for Branch Syncing

### Sync main → development

```bash
git checkout development
git pull origin development
git merge main
git push origin development
```

Or use GitHub PRs for better control and CI validation.

### Create Release Tag (Optional)

```bash
# Tag production release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## Environment Variables

Each branch can have different environment variables via wrangler.toml:

```toml
[env.production]
vars = { ENVIRONMENT = "production", API_URL = "https://api.ciagotech.com" }

[env.staging]
vars = { ENVIRONMENT = "staging", API_URL = "https://staging-api.ciagotech.com" }

[env.development]
vars = { ENVIRONMENT = "development", API_URL = "http://localhost:8000" }
```

Access in your app code:

```typescript
console.log(ENVIRONMENT); // "production", "staging", or "development"
```

## Monitoring Deployments

### GitHub Actions

- Check deployment status: GitHub → Actions tab → CD workflow
- View deployment history: Repository → Deployments

### Cloudflare

- Dashboard → Workers & Pages → View production worker
- Check analytics and performance metrics
- View error logs and debugging information

## Next Steps

1. ✅ Create branches (development, staging, production)
2. ✅ Push code to all branches
3. ✅ Update CI workflow
4. ✅ Create CD workflow
5. ⏳ Add Cloudflare API credentials to GitHub Secrets
6. ⏳ Configure wrangler.toml with your account ID
7. ⏳ Test CI/CD pipeline with a test push to production
8. ⏳ Set up branch protection rules
9. ⏳ Configure DNS/domain routing to Cloudflare Workers
