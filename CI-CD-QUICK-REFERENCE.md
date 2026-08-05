# CI/CD Quick Reference

## Branch Deployment Flow

```
Your Feature
    ↓
main (development branch)
    ↓
development (team testing)
    ↓
staging (pre-production)
    ↓
production (GitHub Org - AUTO-DEPLOYS to ciagotech.com)
```

## Key Commands

### Local Testing
```bash
# Test everything before pushing
bun run lint      # Check code quality
bun run test      # Run tests
bun run build     # Build for production
bun run format    # Auto-fix formatting
```

### Manual Deployment (if needed)
```bash
# Deploy to Cloudflare Workers
bun run deploy         # Production (ciagotech.com)
bun run deploy:staging # Staging
bun run deploy:dev     # Development
```

### Git Workflow
```bash
# Feature branch
git checkout -b feature/name main
git push origin feature/name
# → Create PR to main on personal GitHub

# Sync to development
git checkout development
git merge main
git push origin development
# → Optional: bun run deploy:dev

# Sync to staging
git checkout staging
git merge development
git push origin staging
# → Optional: bun run deploy:staging

# Deploy to production
git checkout production
git merge staging
git push https://github.com/Ciago-Technologies/website.git production
# → Auto-deploys to ciagotech.com!
```

## CI/CD Status

| Step | Status | Trigger |
|------|--------|---------|
| **CI Check** | ✅ Ready | Push to any branch or PR |
| **CD Deploy** | ✅ Ready | Push to production branch |
| **Domain** | ⏳ Configure | ciagotech.com |
| **Secrets** | ⏳ Configure | 3 GitHub secrets needed |

## GitHub Organization Setup

The **production** branch is in the GitHub **Ciago-Technologies** organization:
```
https://github.com/Ciago-Technologies/website
```

Push to this repo's `production` branch to trigger auto-deployment.

## What Gets Deployed

- Your React/TanStack Start application
- Built with Vite + Nitro (Cloudflare Workers)
- Deployed to `ciagotech.com` domain
- All environment variables injected at build time

## Troubleshooting

**CI fails?** → Run `bun run lint` and `bun run test` locally
**CD fails?** → Check GitHub Actions logs → Check Cloudflare dashboard
**Domain issues?** → Verify DNS points to Cloudflare → Check Workers route

## Configuration Needed

Before first production deployment:

```bash
# 1. Add GitHub Secrets (3 items)
#    - CLOUDFLARE_API_TOKEN
#    - CLOUDFLARE_ACCOUNT_ID  
#    - WRANGLER_AUTH_TOKEN

# 2. Update wrangler.toml
#    - Add your CLOUDFLARE_ACCOUNT_ID

# 3. Configure Cloudflare Domain Routing
#    - Add route: ciagotech.com/* → worker
```

See **CI-CD-SETUP-COMPLETE.md** for detailed instructions.

## Monitoring Deployments

**GitHub Actions**: https://github.com/Ciago-Technologies/website/actions
- View CI/CD workflow runs
- Check deployment logs
- Monitor real-time build status

**Cloudflare Dashboard**: https://dash.cloudflare.com
- View worker deployments
- Monitor performance metrics
- Check error logs

---

**Quick Links**:
- 📖 [Full CI/CD Guide](./CI-CD-GUIDE.md)
- ✅ [Setup Checklist](./CI-CD-SETUP-COMPLETE.md)
- 🔧 [Wrangler Config](./wrangler.toml)
- 🚀 [GitHub Actions](https://github.com/Ciago-Technologies/website/actions)
