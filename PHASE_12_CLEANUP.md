# Phase 12 — Final Cleanup Tasks

## Type Errors to Fix (35 total)

### 1. Deleted Role References (9 errors)
**Files**: `audit.functions.ts`, `feature-flags.functions.ts`, `mobility.functions.ts`

**Issue**: Code still references deleted roles: "hr", "manager", "employee"

**Fix Strategy**:
- Search all occurrences of `"hr"`, `"manager"`, `"employee"` as role values
- Replace with `"admin"` or `"user"` based on context
- Remove conditional logic for deleted roles

**Files to Fix**:
```bash
src/lib/audit.functions.ts:30       - Type '"hr"' not assignable
src/lib/feature-flags.functions.ts:32-34 - Type '"hr"/"manager"/"employee"' not assignable
src/lib/mobility.functions.ts:62    - Type '"employee"/"manager"' not assignable
```

### 2. Deleted Table References (5 errors)
**Files**: `employee.functions.ts`

**Issue**: `employeeTask` model was deleted (Phase 2)

**Fix Strategy**:
- Remove all `employeeTask` references
- Delete functions that depend on deleted table
- Or comment out if needed for future reference

**Files to Fix**:
```bash
src/lib/employee.functions.ts:35,58,91,106 - Property 'employeeTask' does not exist
```

### 3. Deleted Job Track Types (3 errors)
**Files**: `hr.functions.ts`

**Issue**: `hr_track` and `manager_track` were removed from `JobTrackType` enum (Phase 1)

**Fix Strategy**:
- Remove comparisons to deleted track types
- All jobs now use `"standard"` track type

**Files to Fix**:
```bash
src/lib/hr.functions.ts:650,659 - 'hr_track'/'manager_track' comparisons
```

### 4. Import Path Errors (2 errors)
**Files**: `orangehrm.functions.ts`

**Issue**: These are false positives from running tsc directly without path resolution

**Fix**: None needed - these work at runtime with proper bundler

---

## Dead Code to Remove

### 1. Unused Functions
Check these files for functions that are no longer called:
- `src/lib/hr.functions.ts` - May have functions only used by deleted HR portal
- `src/lib/employee.functions.ts` - Has deleted task-related functions

### 2. Unused Routes
Verify these redirects are in place:
- `/estimate` → `/` (Phase 2)
- `/employee` → removed (Phase 2)
- `/hr` → removed (Phase 2)
- `/manager` → removed (Phase 2)

---

## Security Checks

### 1. RLS Policies
Verify these policies work with new role system:
```sql
-- Check employees table policies
SELECT * FROM pg_policies WHERE tablename = 'employees';

-- Check service_account_mappings policies
SELECT * FROM pg_policies WHERE tablename = 'service_account_mappings';

-- Check emails table policies
SELECT * FROM pg_policies WHERE tablename = 'emails';
```

### 2. Auth Guards
Manually verify:
- [ ] `/admin` requires admin role
- [ ] `/my-applications` requires any authenticated user
- [ ] `/users` requires admin role
- [ ] API routes have proper auth checks

### 3. Upload Path Validation
Test:
- [ ] Upload resume as user A
- [ ] Try to access user B's upload path
- [ ] **Expected**: 403 Forbidden

---

## SEO Verification

### 1. Sitemap Check
```bash
grep -E "estimate|employee|manager|hr" src/routes/sitemap.xml.ts
```
**Expected**: Only `/estimate` with redirect, others removed

### 2. Robots.txt
Verify no blocked paths affect legitimate pages

### 3. Meta Tags
Check key pages have proper meta:
- [ ] Homepage (/)
- [ ] Careers (/careers)
- [ ] About (/about)
- [ ] Auth (/auth)

---

## Test Suite

### Run All Tests
```bash
npx vitest run
```

**Current Known Failures**:
- `provision.server.test.ts` - Mock issue (pre-existing, not blocking)

**Expected**: All other tests pass

### Test Coverage for New Features
Manual tests required (see TESTING_CHECKLIST.md):
- [ ] Phase 4: Hiring gate blocks when docs not verified
- [ ] Phase 5: Auth guard no flicker on refresh
- [ ] Phase 6: Notifications show valid dates
- [ ] Phase 7: Users directory shows names/jobs/doc counts
- [ ] Phase 8: OrangeHRM employee creation
- [ ] Phase 9: Email tracking in database
- [ ] Phase 10: ConfigCat flags readable

---

## Performance Checks

### 1. Bundle Size
```bash
npm run build
```
Check output for bundle size warnings

### 2. Database Query Performance
Check for N+1 queries in:
- Users directory (list_directory SQL function)
- Applications list (admin.tsx)
- Notifications dropdown

### 3. API Response Times
Monitor in production:
- Application status update: < 2s
- OrangeHRM employee creation: < 5s
- Email send: < 3s

---

## Documentation Updates Needed

### 1. README.md
Update with:
- [ ] New architecture description (two-surface model)
- [ ] OrangeHRM setup steps
- [ ] ConfigCat flag configuration
- [ ] Environment variables (add new ones from Phase 8-11)

### 2. .env.example
Add missing variables:
```env
# OrangeHRM (Phase 8)
ORANGEHRM_BASE_URL=
ORANGEHRM_CLIENT_ID=
ORANGEHRM_CLIENT_SECRET=
ORANGEHRM_REDIRECT_URI=

# Microsoft Teams (Phase 11)
TEAMS_DEFAULT_TEAM_ID=

# Already exist, verify:
GITHUB_ORG=
GITHUB_TOKEN=
CLICKUP_API_TOKEN=
CLICKUP_WORKSPACE_ID=
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
CONFIGCAT_SDK_KEY=
```

### 3. Migration Guide
Document for existing deployments:
- [ ] How to run Prisma migrations
- [ ] How to backfill `orangehrmEmployeeId` for existing employees
- [ ] ConfigCat flag initial values
- [ ] OrangeHRM OAuth setup

---

## Deployment Checklist

Before deploying to production:

### Database
- [ ] Run all migrations in order
- [ ] Verify RLS policies active
- [ ] Check indexes created properly
- [ ] Backup production database

### Environment Variables
- [ ] All required env vars set
- [ ] No hardcoded secrets in code
- [ ] ConfigCat production SDK key configured
- [ ] OrangeHRM production OAuth configured

### Feature Flags
- [ ] All flags created in ConfigCat dashboard
- [ ] `new_architecture_enabled` = false initially
- [ ] `ess_auto_provisioning_enabled` = false initially
- [ ] `resend_email_sending_enabled` = true (after testing)
- [ ] Targeting rules configured for internal users

### Monitoring
- [ ] Error tracking configured (Sentry/similar)
- [ ] Email delivery monitoring (Resend dashboard)
- [ ] OrangeHRM API usage monitoring
- [ ] ConfigCat change notifications (Slack webhook)

### Rollback Plan
- [ ] Git tag created for current production
- [ ] Database backup verified restorable
- [ ] Feature flags can be toggled instantly
- [ ] Rollback procedure documented

---

## Final Smoke Test

In production (after deployment):

1. **As Anonymous User**:
   - [ ] Visit homepage
   - [ ] Browse careers
   - [ ] Submit application
   - [ ] Receive confirmation email

2. **As Authenticated User**:
   - [ ] Login via Clerk
   - [ ] View "My Applications"
   - [ ] Complete onboarding (if hired)
   - [ ] Upload documents
   - [ ] Receive status update notifications

3. **As Admin**:
   - [ ] View applications list
   - [ ] Change application status
   - [ ] Mark as hired (should work if docs verified)
   - [ ] Try to hire without docs (should fail)
   - [ ] View Users directory
   - [ ] See hired user with full data

4. **Integration Tests**:
   - [ ] OrangeHRM employee created on hire
   - [ ] Email sent and tracked in database
   - [ ] Notification bell shows valid dates
   - [ ] ConfigCat flags evaluated correctly

---

## Success Criteria

Phase 12 is complete when:
- ✅ Zero TypeScript errors (`tsc --noEmit`)
- ✅ All tests pass (except known pre-existing failures)
- ✅ No dead routes return 404 (all have redirects)
- ✅ Security audit shows no new vulnerabilities
- ✅ Manual smoke tests pass
- ✅ Documentation complete
- ✅ Deployment checklist items verified

---

## Estimated Time

- Type error fixes: 2-3 hours
- Dead code removal: 1 hour
- Security audit: 1 hour
- Test fixes: 2 hours
- Documentation: 1-2 hours
- **Total: 7-9 hours**

---

## Priority Order

1. **Critical** (blocks deployment):
   - Type errors
   - Security checks
   - Test suite

2. **High** (needed for production):
   - Dead code removal
   - Documentation updates
   - Deployment checklist

3. **Medium** (can be done post-deploy):
   - Performance optimization
   - Additional test coverage
   - Enhanced monitoring
