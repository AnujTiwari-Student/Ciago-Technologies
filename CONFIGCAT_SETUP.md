# ConfigCat Feature Flags Setup

This document describes how to configure the 10 feature flags used in the Ciago Spark platform.

## Prerequisites

- ConfigCat account with access to the project
- SDK Key for each environment (dev, staging, production)

## Flag Configuration

### 1. Architecture Flags

#### `new_architecture_enabled`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Master killswitch for the new two-surface architecture (Admin + User View)
- **Targeting**: 
  - Enable for internal test users first
  - Gradually roll out to production users
- **Impact**: When `false`, legacy four-portal routing is preserved

#### `legacy_portals_readonly`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Makes old HR/Manager/Employee portals read-only during migration
- **Impact**: When `true`, forms are disabled but data remains visible

### 2. OrangeHRM Integration

#### `ess_auto_provisioning_enabled`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Controls automatic employee creation in OrangeHRM when hired
- **Dependencies**: Requires OrangeHRM OAuth configured
- **Impact**: 
  - When `true`: Employee created in OrangeHRM on hire
  - When `false`: Manual employee creation required

#### `orangehrm_salary_sync_enabled`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Controls whether salary is fetched from OrangeHRM API
- **Dependencies**: Requires `ess_auto_provisioning_enabled` and employee existing in OrangeHRM
- **Impact**: Shows/hides OrangeHRM salary data in Employment tab

### 3. Email Integration

#### `resend_email_sending_enabled`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Controls whether emails are actually sent via Resend API
- **Impact**:
  - When `true`: Emails sent to Resend and tracked
  - When `false`: Emails logged to database but not sent

### 4. Provisioning & Offboarding

#### `auto_offboarding_trigger_enabled`
- **Type**: Boolean
- **Default**: `false`
- **Purpose**: Controls automated account revocation on last working day
- **Dependencies**: Phase 11 implementation
- **Impact**: 
  - When `true`: GitHub/Teams/ClickUp accounts auto-revoked on offboard date
  - When `false`: Manual revocation required

### 5. Background Verification

#### `manual_background_verification_only`
- **Type**: Boolean
- **Default**: `true`
- **Purpose**: Informational flag - indicates no automated background check integration
- **Impact**: UI labels and help text reference manual verification process

### 6. Legacy Portal Flags (Pre-existing)

#### `clerkAuthentication`
- **Type**: Boolean
- **Default**: `true`
- **Purpose**: Routes auth through Clerk instead of Supabase Auth

#### `authenticationButtonEnabled`
- **Type**: Boolean
- **Default**: `true`
- **Purpose**: Controls whether sign-in button is visible

#### `dashboardEnabled`
- **Type**: Boolean
- **Default**: `true`
- **Purpose**: Controls access to authenticated dashboard surfaces

## Setup Steps

### 1. Create Flags in ConfigCat Dashboard

For each environment (dev, staging, production):

1. Login to ConfigCat dashboard: https://app.configcat.com
2. Select your project: **Ciago Spark**
3. Navigate to **Feature Flags**
4. Create each flag with the settings above

### 2. Configure Targeting Rules

#### `new_architecture_enabled` Targeting:

```
Rule 1: Internal Test Users
  IF user.email CONTAINS "@ciagotech.com"
  THEN true
  ELSE false

Rule 2: Beta Testers (after internal testing)
  IF user.custom.beta_tester = true
  THEN true
  ELSE false
```

#### Progressive Rollout Strategy:

1. **Week 1**: Enable for `@ciagotech.com` emails only (internal team)
2. **Week 2**: Enable for selected beta users
3. **Week 3**: 10% rollout to production users
4. **Week 4**: 50% rollout
5. **Week 5**: 100% if no issues

### 3. Environment SDK Keys

Update `.env` for each environment:

**Development:**
```env
CONFIGCAT_SDK_KEY="configcat-sdk-1/YOUR-DEV-KEY-HERE"
```

**Staging:**
```env
CONFIGCAT_SDK_KEY="configcat-sdk-1/YOUR-STAGING-KEY-HERE"
```

**Production:**
```env
CONFIGCAT_SDK_KEY="configcat-sdk-1/YOUR-PRODUCTION-KEY-HERE"
```

### 4. Setup Webhooks (Optional but Recommended)

1. In ConfigCat, navigate to **Integrations → Webhooks**
2. Add webhook for Slack notifications:
   - URL: Your Slack webhook URL
   - Events: Flag value changed, Flag created, Flag deleted
   - This notifies the team when flags change

### 5. Verify Integration

Run the verification script:

```bash
npx tsx scripts/test-configcat-flags.ts
```

Expected output:
```
✅ ConfigCat SDK initialized
✅ All 10 flags readable
✅ Default values correct
✅ Targeting rules working
```

## Flag Dependencies

Some flags depend on others being enabled:

```
new_architecture_enabled (master)
  ↓
ess_auto_provisioning_enabled
  ↓
orangehrm_salary_sync_enabled

resend_email_sending_enabled (independent)

auto_offboarding_trigger_enabled (independent, requires Phase 11)
```

## Rollback Procedure

If issues arise after enabling a flag:

1. **Immediate**: Toggle flag to `false` in ConfigCat dashboard
2. **Propagation**: Changes take effect within 60 seconds (auto-poll interval)
3. **Verify**: Check application logs for flag evaluation
4. **Communicate**: Post in Slack that flag was rolled back

## Monitoring

### Flag Usage Metrics

ConfigCat tracks:
- Flag evaluation count
- Percentage of users seeing each variant
- Targeting rule match rates

View in: **ConfigCat Dashboard → Statistics**

### Application Logs

Flag evaluations are logged at debug level:

```
[configcat] Evaluating flag: ess_auto_provisioning_enabled
[configcat] Target user: user@example.com
[configcat] Result: true (via targeting rule: internal_users)
```

## Testing Locally

Override flags for local development in `.env.local`:

```env
# Force enable all new features locally
VITE_FORCE_FLAG_new_architecture_enabled=true
VITE_FORCE_FLAG_ess_auto_provisioning_enabled=true
```

**Note**: Force overrides only work in development mode.

## Reference

- ConfigCat Docs: https://configcat.com/docs/
- SDK Reference: https://configcat.com/docs/sdk-reference/node/
- Feature Flag Best Practices: https://configcat.com/blog/feature-flag-best-practices/
