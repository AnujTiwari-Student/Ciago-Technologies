# OrangeHRM Auto-Sync

## Overview
Automatic synchronization of data from our system to OrangeHRM. When you create job postings, departments, or hire employees, the necessary data is automatically created in OrangeHRM.

## What Gets Auto-Synced

### 1. **Job Titles** ✅
- **When:** When hiring someone with a new job title OR when syncing job postings
- **Source:** Job posting titles
- **Action:** Creates job title in OrangeHRM if not found

### 2. **Departments (Sub-Units)** ✅
- **When:** When hiring someone for a new department
- **Source:** Our departments table
- **Action:** Creates sub-unit in OrangeHRM if not found

### 3. **Employment Statuses** ✅
- **When:** When hiring someone with a new employment type
- **Source:** Our employment types
- **Mapping:**
  ```
  full_time  → "Full-Time Permanent"
  contract   → "Full-Time Contract" or "Contract"
  part_time  → "Part-Time"
  internship → "Intern"
  ```

### 4. **Job Postings (Complete Details)** ✅ NEW!
- **When:** Manual sync OR automatic when creating/updating jobs
- **Source:** Job postings table
- **Action:** Creates/updates job vacancy in OrangeHRM with ALL details
- **Details Synced:**
  - ✅ Job title & description
  - ✅ Requirements & qualifications
  - ✅ Salary range (min/max in INR)
  - ✅ Department & location
  - ✅ Employment type
  - ✅ Status (Draft/Published/Closed)
  - ✅ Remote/On-site indicator
  - ✅ Internal-only flag
  - ✅ Skills & tags

## How It Works

### Automatic (During Hire)
When you mark someone as "Hired":

```
1. Check if job title exists in OrangeHRM
   ├─ Found → Use existing ID
   └─ Not found → Create it automatically ✨

2. Check if department exists in OrangeHRM
   ├─ Found → Use existing ID
   └─ Not found → Create it automatically ✨

3. Check if employment status exists in OrangeHRM
   ├─ Found → Use existing ID
   └─ Not found → Create it automatically ✨

4. Create employee with all matched/created IDs
```

### Manual Bulk Sync
Sync all existing data from our system to OrangeHRM at once:

```bash
npx tsx scripts/sync-to-orangehrm.ts
```

This will:
- ✅ Create all departments from our database
- ✅ Create standard employment statuses
- ✅ Create all job titles from job postings
- ✅ **Sync all job postings with complete details** (NEW!)
- ⏭️ Skip items that already exist
- ⚠️ Report any failures

## Setup

### 1. Enable Feature Flag
```env
# In ConfigCat or .env
ess_auto_provisioning_enabled = true
```

### 2. Ensure OrangeHRM is Running
```bash
# Check if accessible
curl http://localhost:8280
```

### 3. Valid OAuth Tokens
```bash
# Run if needed
npx tsx scripts/orangehrm-auth.ts
```

## Usage

### Option 1: Bulk Sync Everything (Recommended First Time)

Run this once to sync all existing data:

```bash
npx tsx scripts/sync-to-orangehrm.ts
```

**Output:**
```
🔄 FULL SYNC TO ORANGEHRM
==================================================

🔄 Syncing departments to OrangeHRM...
✅ Created department: Engineering (ID: 2)
✅ Created department: Product (ID: 3)
✅ Created department: Design (ID: 4)

🔄 Syncing employment statuses to OrangeHRM...
✅ Created employment status: Full-Time Permanent (ID: 1)
✅ Created employment status: Intern (ID: 2)
✅ Created employment status: Contract (ID: 3)

🔄 Syncing job titles to OrangeHRM...
✅ Created job title: Software Engineer (ID: 1)
✅ Created job title: Software Engineer Intern (ID: 2)

📋 Now syncing job postings...

============================================================
📋 SYNCING JOB POSTINGS TO ORANGEHRM
============================================================

Found 3 job postings to sync

[orangehrm-job-sync] 📋 Syncing job: "Senior Software Engineer"
✅ Created vacancy: "Senior Software Engineer" (ID: 1)

[orangehrm-job-sync] 📋 Syncing job: "Product Manager"
✅ Created vacancy: "Product Manager" (ID: 2)

✅ SYNC COMPLETE
==================================================
Departments: 3 created, 1 existed, 0 failed
Employment Statuses: 3 created, 0 existed, 0 failed
Job Titles: 2 created, 0 existed, 0 failed
Job Postings: 2 created, 1 updated, 0 failed
```

### Option 2: Automatic During Hire

Just hire someone! The system will auto-create missing data:

**Console logs show what's happening:**
```
[orangehrm-sync] Looking for job title: "Senior Backend Engineer"
[orangehrm-sync] No match found, creating job title: "Senior Backend Engineer"
[orangehrm-sync] ✅ Created job title: Senior Backend Engineer (ID: 5)

[orangehrm-sync] Looking for sub-unit: "Engineering"
[orangehrm-sync] Exact match found: Engineering (ID: 2)

[orangehrm-sync] Looking for employment status: "full_time"
[orangehrm-sync] Exact match found: Full-Time Permanent (ID: 1)

[orangehrm-sync] Updating job details with: { jobTitleId: 5, empStatusId: 1, subUnitId: 2 }
[orangehrm-sync] ✅ Job details updated successfully
```

## Files

### New Files
- ✅ `src/lib/orangehrm-bulk-sync.ts` - Bulk sync for master data
- ✅ `src/lib/orangehrm-job-sync.ts` - Job posting sync logic (NEW!)
- ✅ `scripts/sync-to-orangehrm.ts` - Manual sync script

### Modified Files
- ✅ `src/integrations/orangehrm/client.ts` - Added create methods + job vacancy methods
- ✅ `src/integrations/orangehrm/types.ts` - Added JobVacancy types
- ✅ `src/lib/orangehrm-sync.ts` - Auto-create on match failure

## Testing

### Test 1: Check Current State
```bash
npx tsx scripts/test-orangehrm-data.ts
```

Should show empty or minimal data.

### Test 2: Run Bulk Sync
```bash
npx tsx scripts/sync-to-orangehrm.ts
```

### Test 3: Verify Sync
```bash
npx tsx scripts/test-orangehrm-data.ts
```

Should now show:
- ✅ Multiple job titles
- ✅ Multiple departments
- ✅ Multiple employment statuses

### Test 4: Hire Someone
1. Mark a candidate as "Hired"
2. Check OrangeHRM - employee should have:
   - ✅ Name
   - ✅ Job Title
   - ✅ Employment Status
   - ✅ Department
   - ✅ Work Email
   - ✅ Join Date

## Error Handling

### Permission Errors
If you get "403 Forbidden" or "401 Unauthorized":

**Cause:** OAuth token doesn't have admin permissions

**Solution:**
1. Check OrangeHRM user has Admin role
2. Re-authenticate: `npx tsx scripts/orangehrm-auth.ts`
3. Use admin credentials when authenticating

### API Endpoint Not Found
If you get "404 Not Found" on create endpoints:

**Cause:** OrangeHRM version might not support these endpoints

**Solution:**
1. Check OrangeHRM version (need v5.0+)
2. Manually add the missing data
3. Auto-sync will then match to existing data

### Duplicate Names
If you get "Duplicate entry" errors:

**Cause:** OrangeHRM already has item with same name

**Solution:**
- System will detect existing items and skip them
- No action needed - this is expected

## Benefits

### Before Auto-Sync ❌
1. Create job posting in our system
2. **Manually** login to OrangeHRM
3. **Manually** create job vacancy
4. **Manually** copy-paste title, description, requirements
5. **Manually** set salary, location, status
6. Mark candidate as hired in our system
7. Employee created in OrangeHRM with only name
8. **Manually** create/assign job title
9. **Manually** create/assign employment status
10. **Manually** create/assign department
11. Repeat for every job and hire 😫

### After Auto-Sync ✅
1. Create job posting in our system
2. Run: `npx tsx scripts/sync-to-orangehrm.ts`
3. **Job vacancy auto-created with ALL details!** 🎉
4. Mark candidate as hired
5. **Employee auto-created with full info!** 🎉
6. Everything stays in sync automatically!

## Monitoring

### Check Audit Logs
```sql
SELECT details FROM audit_logs
WHERE action = 'ORANGEHRM_EMPLOYEE_CREATED'
ORDER BY timestamp DESC LIMIT 1;
```

Should show populated IDs:
```json
{
  "orangehrm_emp_number": 7,
  "job_title_id": 5,
  "employment_status_id": 1,
  "subunit_id": 2
}
```

### Console Logs
Watch for:
```
✅ Created job title: ...
✅ Created sub-unit: ...
✅ Created employment status: ...
✅ Job details updated successfully
```

Or warnings:
```
❌ Failed to create job title: <error>
```

## Maintenance

### Add New Department in Our System
```sql
INSERT INTO departments (name, code) VALUES ('Marketing', 'MKT');
```

**Then sync:**
```bash
npx tsx scripts/sync-to-orangehrm.ts
```

### Add New Employment Type
Update the mapping in `src/lib/orangehrm-sync.ts`:
```typescript
const statusMapping: Record<string, string[]> = {
  full_time: ["Full-Time Permanent", ...],
  new_type: ["New Type Name"],  // Add here
};
```

### Periodic Re-Sync
Run monthly or when adding many new job postings:
```bash
npx tsx scripts/sync-to-orangehrm.ts
```

## Troubleshooting

### Q: Still only seeing employee name in OrangeHRM
**A:** Check console logs during hire. If you see:
```
❌ Failed to create job title: <error>
```
The auto-create failed. Run bulk sync manually:
```bash
npx tsx scripts/sync-to-orangehrm.ts
```

### Q: Bulk sync shows all "existed"
**A:** Good! Data is already synced. Test by hiring someone.

### Q: Some items fail to create
**A:** Check:
1. OrangeHRM user has Admin role
2. OAuth token is fresh
3. OrangeHRM version supports API (v5.0+)

### Q: Want to re-sync from scratch
**A:** 
1. Delete items from OrangeHRM Admin
2. Run: `npx tsx scripts/sync-to-orangehrm.ts`

## Related Documentation
- `ORANGEHRM_JOB_POSTING_SYNC.md` - **Comprehensive job posting sync guide** (NEW!)
- `ORANGEHRM_FULL_PROVISIONING.md` - Employee provisioning details
- `ORANGEHRM_DEBUG_GUIDE.md` - Debug steps
- `scripts/test-orangehrm-data.ts` - Check current state
- `scripts/sync-to-orangehrm.ts` - Bulk sync script
