# OrangeHRM Docker Setup

This project uses OrangeHRM 5.7 running in Docker for employee management and ESS provisioning.

## Quick Start

### 1. Start OrangeHRM

```bash
docker-compose up -d
```

This starts:
- **OrangeHRM Web UI**: http://localhost:8280
- **MariaDB**: Internal network only

### 2. Initial Setup

1. Open http://localhost:8280 in your browser
2. Follow the installation wizard:
   - Database Host: `orangehrm-db`
   - Database Port: `3306`
   - Database Name: `orangehrm`
   - Database User: `orangehrm_user`
   - Database Password: `orangehrm_pass`
   - Admin Username: `admin`
   - Admin Password: Choose a strong password (save it!)

### 3. Register OAuth Client

1. Login to OrangeHRM at http://localhost:8280
2. Navigate to: **Admin → Configuration → Register OAuth Client**
3. Create a new OAuth2 client with these settings:
   - **Client Name**: `Ciago API Client`
   - **Redirect URI**: `http://localhost:8080/oauth/orangehrm/callback`
   - **Grant Types**: Check **Authorization Code**
   - **Confidential Client**: ✅ Yes
4. Click **Save** and copy the generated credentials
5. Update `.env`:
   ```env
   ORANGEHRM_CLIENT_ID="your-generated-client-id"
   ORANGEHRM_CLIENT_SECRET="your-generated-client-secret"
   ORANGEHRM_REDIRECT_URI="http://localhost:8080/oauth/orangehrm/callback"
   ```

### 4. Authorize the Application

Run the OAuth authorization flow:

```bash
npx tsx scripts/orangehrm-auth.ts
```

This will:
1. Start a local callback server on port 3001
2. Print an authorization URL
3. Open your browser to OrangeHRM login
4. After you login and approve, tokens are saved to `.orangehrm-token.json`

**Important**: 
- The redirect URI MUST match exactly what you registered in OrangeHRM
- Make sure your Vite dev server (port 8080) is running for the proxy to work
- Tokens are stored locally and auto-refresh when needed

### 5. Configure User Roles

For ESS provisioning to work:

1. Go to **Admin → User Management → User Roles**
2. Ensure the **ESS** (Employee Self Service) role exists
3. Note the role ID (typically `2` for ESS)

### 6. Test Integration

Run the test script to verify API connectivity:

```bash
npx tsx scripts/test-orangehrm-connection.ts
```

## Architecture

### Data Flow

1. **Application Status → Hired**:
   - Creates Employee in OrangeHRM via API
   - Stores `orangehrmEmployeeId` in local DB
   - Creates Profile + Employee records locally

2. **DOJ Assignment**:
   - Updates Employee status in OrangeHRM

3. **ESS Account Creation** (when enabled):
   - Creates user account in OrangeHRM
   - Assigns ESS role
   - Emails credentials via Resend

### API Endpoints Used

- `POST /api/v2/pim/employees` — Create employee
- `GET /api/v2/pim/employees/{id}` — Fetch employee details
- `GET /api/v2/pim/employees/{id}/salary-components` — Get salary
- `POST /api/v2/admin/users` — Create ESS user account
- `PUT /api/v2/admin/users/{id}` — Update user status

## Feature Flags

All OrangeHRM integration is gated behind ConfigCat flags:

- `ess_auto_provisioning_enabled` — Controls employee creation + ESS account setup
- `orangehrm_salary_sync_enabled` — Controls salary fetch from OrangeHRM

When flags are `false`, the hire flow still works but skips OrangeHRM calls.

## Troubleshooting

### Connection Refused

- Ensure docker containers are running: `docker-compose ps`
- Check logs: `docker-compose logs orangehrm`

### OAuth Token Error

- Verify client ID/secret in `.env` match OrangeHRM config
- Check client credentials grant type is enabled

### API 403 Forbidden

- Verify OAuth client has correct scopes
- Check OrangeHRM user permissions

### Database Connection Failed

- Wait 30s for MariaDB to initialize on first run
- Check DB health: `docker-compose logs orangehrm-db`

## Stopping/Resetting

```bash
# Stop containers
docker-compose down

# Reset everything (deletes data)
docker-compose down -v

# View logs
docker-compose logs -f orangehrm
```

## Production Deployment

For production, use a managed OrangeHRM instance:

1. Update `ORANGEHRM_BASE_URL` to production URL
2. Create production OAuth client
3. Update credentials in production `.env`
4. Enable feature flags in ConfigCat production environment
