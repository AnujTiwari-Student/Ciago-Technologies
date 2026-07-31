# Offboarding Automation Setup

This document describes how to set up automated offboarding for employees who reach their `last_working_day`.

---

## Overview

The offboarding automation:
1. Runs daily via cron job
2. Checks for employees who have reached their last working day
3. Automatically revokes access to:
   - GitHub organization
   - Microsoft Teams
   - ClickUp workspace
   - OrangeHRM ESS
4. Marks service account mappings as inactive
5. Logs all actions to audit trail

**Feature Flag**: `auto_offboarding_trigger_enabled`

---

## Setup Instructions

### 1. Configure Cron Job

Add to your crontab (runs daily at 2 AM):

```bash
0 2 * * * cd /path/to/ciago-spark && npx tsx scripts/offboarding-poll.ts >> /var/log/offboarding-poll.log 2>&1
```

**Alternative schedules:**

```bash
# Every day at midnight
0 0 * * * cd /path/to/ciago-spark && npx tsx scripts/offboarding-poll.ts

# Every weekday at 9 AM
0 9 * * 1-5 cd /path/to/ciago-spark && npx tsx scripts/offboarding-poll.ts

# Every hour (for testing)
0 * * * * cd /path/to/ciago-spark && npx tsx scripts/offboarding-poll.ts
```

### 2. Environment Variables

Ensure these are set in your environment:

```bash
NEON_DATABASE_URL="postgresql://..."
GITHUB_TOKEN="ghp_..."
AZURE_TENANT_ID="..."
AZURE_CLIENT_ID="..."
AZURE_CLIENT_SECRET="..."
ORANGEHRM_BASE_URL="http://..."
ORANGEHRM_CLIENT_ID="..."
ORANGEHRM_CLIENT_SECRET="..."
CONFIGCAT_SDK_KEY="..."
```

### 3. Feature Flag

Create the flag in ConfigCat dashboard:

**Flag**: `auto_offboarding_trigger_enabled`  
**Type**: Boolean  
**Default**: `false` (start disabled for safety)  
**Description**: Gates automatic offboarding on last_working_day

**Targeting Rules:**
- Initially: `false` for all users
- After testing: `true` for production

### 4. Database Schema

Ensure the `employees` table has the necessary fields:

```sql
-- Check if last_working_day field exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
  AND column_name = 'last_working_day';

-- Add if missing (adjust as needed)
ALTER TABLE employees ADD COLUMN last_working_day DATE;
```

---

## Testing

### 1. Manual Test Run

```bash
cd /path/to/ciago-spark
npx tsx scripts/offboarding-poll.ts
```

**Expected output:**
```
======================================
Offboarding Poll Started
Time: 2026-08-01T02:00:00.000Z
======================================

⏸️  auto_offboarding_trigger_enabled = false, skipping poll
```

### 2. Enable Feature Flag

In ConfigCat dashboard, set `auto_offboarding_trigger_enabled` = `true`

### 3. Create Test Employee

```sql
-- Insert test employee with past last_working_day
INSERT INTO employees (user_id, account_status, last_working_day)
VALUES (
  'test-user-id',
  'active',
  CURRENT_DATE - INTERVAL '1 day'
);

-- Insert service account mapping
INSERT INTO service_account_mappings (employee_id, status, github_username)
VALUES ('test-user-id', 'active', 'test-github-user');
```

### 4. Run Script Again

```bash
npx tsx scripts/offboarding-poll.ts
```

**Expected output:**
```
Found 1 employee(s) for offboarding check

[offboarding] Processing employee: test-user-id
[offboarding] ✓ GitHub revoked: test-github-user
[offboarding] ✓ Completed for test-user-id

======================================
Offboarding Poll Complete
Success: 1
Errors: 0
======================================
```

### 5. Verify Results

```sql
-- Check service account mapping is inactive
SELECT status, deprovisioned_at 
FROM service_account_mappings 
WHERE employee_id = 'test-user-id';

-- Check audit log
SELECT action, details 
FROM audit_logs 
WHERE action = 'AUTO_OFFBOARDING_TRIGGERED'
ORDER BY timestamp DESC 
LIMIT 1;

-- Check employee status
SELECT account_status 
FROM employees 
WHERE user_id = 'test-user-id';
```

---

## Monitoring

### Log Files

The cron job redirects output to a log file:

```bash
# View recent logs
tail -f /var/log/offboarding-poll.log

# View today's activity
grep "$(date +%Y-%m-%d)" /var/log/offboarding-poll.log

# Count offboardings this month
grep "Success:" /var/log/offboarding-poll.log | wc -l
```

### Audit Trail

All offboarding actions are logged to the `audit_logs` table:

```sql
-- View recent offboarding actions
SELECT timestamp, target_resource, details
FROM audit_logs
WHERE action = 'AUTO_OFFBOARDING_TRIGGERED'
ORDER BY timestamp DESC
LIMIT 10;

-- Count offboardings by date
SELECT DATE(timestamp) as date, COUNT(*) as count
FROM audit_logs
WHERE action = 'AUTO_OFFBOARDING_TRIGGERED'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Alerts

Set up monitoring alerts for:

1. **Cron job failures**: No output in log file for 25+ hours
2. **High error rate**: More than 10% failures
3. **Feature flag changes**: ConfigCat webhook to Slack

---

## Troubleshooting

### Issue: Cron job not running

**Check:**
```bash
# Verify crontab
crontab -l | grep offboarding

# Check cron logs
grep CRON /var/log/syslog | grep offboarding

# Test script manually
cd /path/to/ciago-spark && npx tsx scripts/offboarding-poll.ts
```

### Issue: "NEON_DATABASE_URL not set"

**Fix:** Add environment variables to cron:

```bash
# Method 1: Source .env in crontab
0 2 * * * cd /path/to/ciago-spark && . ./.env && npx tsx scripts/offboarding-poll.ts

# Method 2: Use shell wrapper script
0 2 * * * /path/to/ciago-spark/scripts/offboarding-cron.sh
```

Create `scripts/offboarding-cron.sh`:
```bash
#!/bin/bash
cd /path/to/ciago-spark
source .env
npx tsx scripts/offboarding-poll.ts
```

### Issue: GitHub API rate limit

**Symptoms:** Error: "API rate limit exceeded"

**Fix:**
- Use a GitHub token with higher rate limits
- Run script less frequently (daily instead of hourly)
- Implement exponential backoff

### Issue: Feature flag always false

**Check:**
```bash
# Test ConfigCat connection
npx tsx scripts/test-configcat-flags.ts

# Verify SDK key
grep CONFIGCAT_SDK_KEY .env
```

---

## Manual Offboarding

If automatic offboarding is disabled or fails, use the manual process:

### Via Admin UI

1. Navigate to Users page
2. Click on employee
3. Scroll to "Service Account Provisioning" section
4. Click "Deprovision All"

### Via Script

```bash
npx tsx scripts/manual-offboard.ts --employee-id=<uuid>
```

---

## Security Considerations

1. **Audit Logging**: All offboarding actions are logged with full details
2. **No Deletion**: Accounts are disabled, not deleted (preserves audit trail)
3. **Mapping Retention**: service_account_mappings rows remain for historical record
4. **Feature Flag**: Can be instantly disabled if issues occur
5. **Manual Override**: Admins can manually deprovision at any time

---

## Rollback

If automatic offboarding causes issues:

### 1. Disable Feature Flag (Instant)
Set `auto_offboarding_trigger_enabled` = `false` in ConfigCat

### 2. Disable Cron Job
```bash
crontab -e
# Comment out the offboarding line
```

### 3. Restore Access (if needed)
```sql
-- Reactivate service account mapping
UPDATE service_account_mappings
SET status = 'active', deprovisioned_at = NULL
WHERE employee_id = '<uuid>';

-- Reactivate employee
UPDATE employees
SET account_status = 'active'
WHERE user_id = '<uuid>';
```

Then manually re-provision access via Admin UI.

---

## Production Checklist

Before enabling in production:

- [ ] Cron job configured and tested
- [ ] Feature flag created in ConfigCat
- [ ] Database schema includes last_working_day field
- [ ] All environment variables set
- [ ] Log file location configured and writable
- [ ] Monitoring alerts configured
- [ ] Manual offboarding tested
- [ ] Rollback procedure documented and tested
- [ ] Team trained on monitoring and troubleshooting

---

## Future Enhancements

1. **Notification Emails**: Send notification when access is revoked
2. **Grace Period**: Allow X days after last_working_day before revoking
3. **Partial Revocation**: Revoke services in stages (e.g., GitHub first, ESS after 30 days)
4. **Reactivation Workflow**: Simple way to restore access if rehired
5. **Webhook Integration**: Trigger offboarding from external HR system

---

*Last Updated: August 1, 2026*  
*Owner: Engineering Team*
