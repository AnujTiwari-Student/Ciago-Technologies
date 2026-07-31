# Testing Checklist for Manual Verification

## Phase 5 — Auth Guard Fix

### Test 1: Hard refresh while logged in
- [ ] Login to the application
- [ ] Navigate to `/admin` or `/my-applications`
- [ ] Press Ctrl+Shift+R (hard refresh)
- [ ] **Expected**: Should stay on the same page, NO redirect to login
- [ ] **Expected**: No flicker, smooth load

### Test 2: Unauthenticated redirect
- [ ] Open browser in incognito mode
- [ ] Navigate directly to `/admin`
- [ ] **Expected**: Redirected to `/auth` with `?redirect=/admin` parameter
- [ ] After login, **Expected**: Auto-redirected back to `/admin`

### Test 3: JWT expiration handling
- [ ] Login and wait 60 seconds
- [ ] Click around the app
- [ ] **Expected**: No errors, token refreshes automatically every 50 seconds
- [ ] Check browser console for: `[clerk-token-bridge]` refresh messages

---

## Phase 6 — Notifications Fix

### Test 1: Create notification
- [ ] As admin, change an application status (e.g., Applied → Screening)
- [ ] Click the bell icon in header
- [ ] **Expected**: Notification shows with VALID timestamp
- [ ] **Expected**: Format like "Jul 31, 02:30 PM"
- [ ] **Expected**: NO "INVALID DATE" text

### Test 2: Multiple notifications
- [ ] Create 3-4 notifications by changing different application statuses
- [ ] Open notification dropdown
- [ ] **Expected**: All timestamps are valid
- [ ] **Expected**: Sorted by newest first
- [ ] **Expected**: Unread count badge shows correct number

### Test 3: Mark as read
- [ ] Click on an unread notification
- [ ] **Expected**: Notification marked as read (styling changes)
- [ ] **Expected**: Badge count decreases

---

## Phase 7 — Users Directory

### Test 1: NAME column shows full name
- [ ] Mark an application as "hired"
- [ ] Navigate to Admin → Users tab
- [ ] **Expected**: Hired user's full name appears (not "—")
- [ ] **Expected**: Email shows below name

### Test 2: Job column displays
- [ ] View hired user in directory
- [ ] **Expected**: Job column shows job ID (8 chars) + job title
- [ ] **Expected**: Both on separate lines

### Test 3: Docs column shows X/Y
- [ ] View hired user in directory
- [ ] **Expected**: Docs column shows "0/5" or similar fraction
- [ ] **Expected**: Badge color: amber if 0, blue if partial, green if all verified

---

## Phase 8 — OrangeHRM Integration

### Test 1: Employee creation on hire
- [ ] Mark application as "hired"
- [ ] Check OrangeHRM at http://localhost:8280
- [ ] **Expected**: New employee created with name from application
- [ ] **Expected**: `orangehrm_employee_id` stored in database

### Test 2: Salary fetch (if configured)
- [ ] Add salary in OrangeHRM for test employee
- [ ] Open Users → Edit → Employment tab
- [ ] **Expected**: Salary shows if `orangehrm_salary_sync_enabled` flag is ON
- [ ] **Expected**: Shows "—" if flag is OFF

### Test 3: Token refresh
- [ ] Wait 30 minutes
- [ ] Trigger any OrangeHRM operation (hire someone)
- [ ] **Expected**: No token errors
- [ ] **Expected**: Auto-refreshes and succeeds

---

## Phase 9 — Email Tracking

### Test 1: Email sent and tracked
- [ ] Enable `resend_email_sending_enabled` flag in ConfigCat
- [ ] Change application status
- [ ] Check database: `SELECT * FROM emails ORDER BY created_at DESC LIMIT 1;`
- [ ] **Expected**: Email record exists with status='sent'
- [ ] **Expected**: Has `resend_id`, `sender`, `recipient`, `subject`

### Test 2: Webhook updates status
- [ ] Send test email
- [ ] Simulate Resend webhook (or wait for real delivery)
- [ ] Check email record again
- [ ] **Expected**: Status updated to 'delivered' when delivered
- [ ] **Expected**: `delivered_at` timestamp populated

### Test 3: Email disabled fallback
- [ ] Set `resend_email_sending_enabled` = false
- [ ] Change application status
- [ ] **Expected**: Email record created but NOT sent
- [ ] **Expected**: Status remains 'pending'
- [ ] **Expected**: No Resend API call made

---

## Phase 10 — ConfigCat Flags

### Test 1: Flag evaluation
```bash
npx tsx scripts/test-configcat-flags.ts
```
- [ ] **Expected**: All 11 flags readable
- [ ] **Expected**: SDK initialized successfully
- [ ] **Expected**: No errors

### Test 2: Targeting rules
- [ ] Change `new_architecture_enabled` value for internal users
- [ ] Run test script with internal email
- [ ] **Expected**: Gets correct targeted value
- [ ] External emails get default value

---

## Phase 11 — Provisioning (When Implemented)

### Test 1: Service account mapping
- [ ] Create mapping for employee
- [ ] **Expected**: Record in `service_account_mappings` table
- [ ] **Expected**: Status = 'active'

---

## Integration Tests

### End-to-End Hire Flow
1. [ ] User applies for job → status = "applied"
2. [ ] Upload resume → stored in R2 with correct path
3. [ ] Admin moves to "offered"
4. [ ] User completes onboarding → uploads 5 documents
5. [ ] Admin verifies all documents
6. [ ] Admin marks as "hired"
7. [ ] **Expected**: Profile created with full name
8. [ ] **Expected**: Employee record created
9. [ ] **Expected**: OrangeHRM employee created (if enabled)
10. [ ] **Expected**: Email sent to candidate
11. [ ] **Expected**: Navigate to Users page → see hired user with all data
12. [ ] **Expected**: Job column shows position
13. [ ] **Expected**: Docs column shows "5/5"

### Hiring Gate
1. [ ] User completes onboarding but only uploads 3/5 documents
2. [ ] Admin tries to mark as "hired"
3. [ ] **Expected**: ERROR toast: "Cannot mark as hired — 2 document(s) still pending verification: ..."
4. [ ] **Expected**: Status does NOT change to hired
5. [ ] **Expected**: Audit log created with HIRE_ATTEMPT_BLOCKED
6. [ ] Admin verifies remaining 2 documents
7. [ ] Admin marks as "hired" again
8. [ ] **Expected**: SUCCESS, status changes to hired

---

## Performance Tests

### ConfigCat Flag Evaluation
```bash
time node -e "
const {isFlagOn} = require('./src/lib/feature-flags.server');
isFlagOn('new_architecture_enabled').then(v => console.log(v));
"
```
- [ ] **Expected**: Returns within 100ms (cached after first call)

### OrangeHRM Token Refresh
- [ ] First API call after token expiry
- [ ] **Expected**: Refresh happens automatically
- [ ] **Expected**: Request succeeds without user intervention
- [ ] **Expected**: < 2 seconds total time including refresh

---

## Regression Tests

### Existing Features Still Work
- [ ] Job posting creation/editing
- [ ] Application submission from careers page
- [ ] Interview scheduling
- [ ] Public pages (about, careers list)
- [ ] User profile editing
- [ ] Notification bell dropdown
- [ ] Resume download links

### Security
- [ ] Cannot access `/admin` without login
- [ ] Cannot upload files to other user's paths
- [ ] Cannot see other users' documents
- [ ] RLS policies enforced (try direct Prisma queries)
- [ ] No secrets in client bundle (check Network tab)

---

## Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

---

## Notes

Mark each checkbox as you complete the test. Document any failures with:
- Date/time
- Steps to reproduce
- Expected vs actual
- Error messages
- Screenshots if applicable

Report blocking issues immediately. Minor issues can be tracked for Phase 12.
