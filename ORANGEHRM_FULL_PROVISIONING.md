# OrangeHRM Full Employee Provisioning

## Overview
Enhanced OrangeHRM integration to provision employees with complete details including job title, employment status, department, email, and more.

## What Was Missing Before

**Before (❌ Incomplete):**
- Only `firstName` and `lastName` sent to OrangeHRM
- Employee created but missing:
  - Job Title
  - Employment Status
  - Department (Sub Unit)
  - Email
  - Join Date
  - Other contact details

**After (✅ Complete):**
- Full employee provisioning with:
  - ✅ Name (first + last)
  - ✅ Job Title (matched from our job postings)
  - ✅ Employment Status (Full-Time, Contract, Part-Time, Intern)
  - ✅ Department/Sub Unit (matched from our departments)
  - ✅ Work Email
  - ✅ Joined Date (hire date)
  - ✅ Auto-generated Employee ID

## New Features

### 1. Intelligent Matching
The system now automatically matches our data to OrangeHRM entities:

#### Job Title Matching
```typescript
// Our job posting: "Senior Software Engineer"
// OrangeHRM matches to:
// - Exact: "Senior Software Engineer"
// - Partial: "Software Engineer" (if exact not found)
// - Case-insensitive matching
```

#### Department Matching
```typescript
// Our department: "Engineering"
// OrangeHRM matches to:
// - Exact: "Engineering"
// - Partial: "Engineering Department" (if exact not found)
```

#### Employment Status Mapping
```typescript
// Our type → OrangeHRM status
full_time    → "Full-Time Permanent" or "Permanent"
contract     → "Full-Time Contract" or "Contract"
part_time    → "Part-Time"
internship   → "Intern" or "Internship"
```

### 2. Multi-Step Provisioning

**Step 1: Create Basic Employee**
```http
POST /api/v2/pim/employees
{
  "firstName": "John",
  "lastName": "Doe"
}
```
Returns: `{ empNumber: 123, employeeId: "0123" }`

**Step 2: Update Job Details**
```http
PUT /api/v2/pim/employees/123/job-details
{
  "jobTitleId": 5,           // Matched from job title
  "empStatusId": 1,          // Matched from employment type
  "subUnitId": 3,            // Matched from department
  "joinedDate": "2026-08-01" // Today's date
}
```

**Step 3: Update Contact Details**
```http
PUT /api/v2/pim/employees/123/contact-details
{
  "workEmail": "john.doe@company.com",
  "otherEmail": "john.doe@company.com"
}
```

### 3. Graceful Fallbacks

If matching fails for any field:
- ✅ Employee still gets created
- ⚠️ Field left blank in OrangeHRM
- 📝 Warning logged in console
- ✅ HR can manually update in OrangeHRM

Example:
```
[orangehrm-sync] No job title match found for: "Chief Happiness Officer"
// Employee created, but jobTitleId not set
// HR can manually assign job title in OrangeHRM
```

## Files Added/Modified

### New Files
1. ✅ **src/lib/orangehrm-sync.ts** - Provisioning logic
   - `provisionEmployeeInOrangeHRM()` - Main provisioning function
   - `findOrCreateJobTitle()` - Job title matching
   - `findSubunit()` - Department matching
   - `findEmploymentStatus()` - Employment status mapping

### Modified Files
1. ✅ **src/integrations/orangehrm/types.ts**
   - Added `EmployeeJobDetailsPayload`
   - Added `EmployeeContactDetailsPayload`
   - Added `UpdateEmployeeDetailsPayload`

2. ✅ **src/integrations/orangehrm/client.ts**
   - Added `updateEmployeeJobDetails()`
   - Added `updateEmployeeContactDetails()`
   - Added `getJobTitles()`
   - Added `getEmploymentStatuses()`
   - Added `getSubunits()`

3. ✅ **src/lib/admin.functions.ts**
   - Updated to use `provisionEmployeeInOrangeHRM()`
   - Enhanced audit log with more details

## API Endpoints Used

### Employee Management
- `POST /api/v2/pim/employees` - Create employee
- `PUT /api/v2/pim/employees/{id}/job-details` - Update job details
- `PUT /api/v2/pim/employees/{id}/contact-details` - Update contact info

### Reference Data (for matching)
- `GET /api/v2/admin/job-titles` - List all job titles
- `GET /api/v2/admin/employment-statuses` - List employment statuses
- `GET /api/v2/admin/subunits` - List departments/sub-units

## Setup Requirements

### 1. OrangeHRM Configuration

**Job Titles:**
Pre-create common job titles in OrangeHRM:
- Admin → Job Titles → Add
- Examples:
  - Software Engineer
  - Senior Software Engineer
  - Engineering Manager
  - Product Manager
  - Designer
  - etc.

**Employment Statuses:**
Pre-create employment statuses:
- Admin → Employment Status → Add
- Examples:
  - Full-Time Permanent
  - Full-Time Contract
  - Part-Time
  - Intern

**Sub Units (Departments):**
Pre-create organizational structure:
- Admin → Organization → Structure
- Add sub-units matching your departments:
  - Engineering
  - Product
  - Design
  - Marketing
  - etc.

### 2. Feature Flag

Enable OrangeHRM provisioning:
```env
# In ConfigCat dashboard
ess_auto_provisioning_enabled = ON

# OR in .env for testing
VITE_ESS_AUTO_PROVISIONING_ENABLED=true
```

### 3. OAuth Tokens

Ensure valid OAuth tokens:
```bash
npx tsx scripts/orangehrm-auth.ts
```

## Testing

### Test Case 1: Full Match
**Setup:**
- Job Posting: "Software Engineer"
- Department: "Engineering"
- Employment Type: "full_time"
- OrangeHRM has matching entries

**Expected:**
```
✅ Employee created with empNumber
✅ Job title set to "Software Engineer"
✅ Employment status set to "Full-Time Permanent"
✅ Sub unit set to "Engineering"
✅ Work email set
✅ Join date set to today
```

### Test Case 2: Partial Match
**Setup:**
- Job Posting: "Senior Backend Engineer"
- OrangeHRM has: "Backend Engineer" (no "Senior" variant)

**Expected:**
```
✅ Employee created
✅ Job title matched to "Backend Engineer" (partial match)
⚠️ Warning logged about partial match
```

### Test Case 3: No Match
**Setup:**
- Job Posting: "Chief Happiness Officer"
- OrangeHRM has no similar job titles

**Expected:**
```
✅ Employee created
❌ Job title not set (null)
⚠️ Warning logged: "No job title match found"
📝 HR can manually assign in OrangeHRM
```

### Test Case 4: API Failures
**Setup:**
- Employee creation succeeds
- Job details update fails (network error)

**Expected:**
```
✅ Employee created with basic info
❌ Job details not updated
⚠️ Error logged but hire process continues
📝 HR can manually update in OrangeHRM
```

## Monitoring

### Audit Log Details
```sql
SELECT details FROM audit_logs
WHERE action = 'ORANGEHRM_EMPLOYEE_CREATED'
ORDER BY timestamp DESC LIMIT 1;
```

**Example output:**
```json
{
  "orangehrm_emp_number": 123,
  "orangehrm_employee_id": "0123",
  "candidate_name": "John Doe",
  "job_title": "Software Engineer",
  "employment_type": "full_time",
  "department": "Engineering",
  "job_title_id": 5,
  "employment_status_id": 1,
  "subunit_id": 3
}
```

### Console Warnings to Watch
```
[orangehrm-sync] No job title match found for: <title>
[orangehrm-sync] No subunit match found for: <department>
[orangehrm-sync] No employment status match found for: <type>
[orangehrm-sync] Job details update failed: <error>
[orangehrm-sync] Contact details update failed: <error>
```

## Manual Cleanup (If Needed)

### If Employee Created But Details Missing

1. **Login to OrangeHRM**
2. **Go to PIM → Employee List**
3. **Find the employee** (search by name)
4. **Click Edit**
5. **Update Job tab:**
   - Job Title
   - Employment Status
   - Sub Unit
   - Joined Date
6. **Update Contact Details tab:**
   - Work Email
   - Mobile

### If Duplicate Employees Created

1. **Check audit logs** for empNumber
2. **Login to OrangeHRM**
3. **Delete duplicate** from PIM → Employee List
4. **Update our database:**
   ```sql
   UPDATE employees
   SET orangehrm_employee_id = <correct_emp_number>
   WHERE user_id = '<user-id>';
   ```

## Troubleshooting

### Issue: Job Title Not Set
**Symptoms:** Employee created but job title blank

**Diagnosis:**
1. Check console for: `No job title match found`
2. List OrangeHRM job titles:
   ```typescript
   const titles = await client.getJobTitles();
   console.log(titles);
   ```

**Solution:**
- Add matching job title in OrangeHRM Admin
- Or manually assign to employee

### Issue: Department Not Set
**Symptoms:** Sub Unit field blank

**Diagnosis:**
1. Check console for: `No subunit match found`
2. List OrangeHRM sub-units:
   ```typescript
   const subunits = await client.getSubunits();
   console.log(subunits);
   ```

**Solution:**
- Add department in OrangeHRM Organization Structure
- Or manually assign to employee

### Issue: Employment Status Not Set
**Symptoms:** Employment Status blank

**Diagnosis:**
1. Check console for: `No employment status match found`
2. Check employment type in job posting
3. Verify status exists in OrangeHRM

**Solution:**
- Add matching employment status in OrangeHRM Admin
- Or manually assign to employee

### Issue: All Fields Blank
**Symptoms:** Only name populated

**Check:**
1. ✅ Feature flag enabled?
2. ✅ OAuth tokens valid?
3. ✅ OrangeHRM accessible?
4. ✅ Network connectivity?
5. ✅ Check audit logs for errors

## Best Practices

### 1. Pre-populate OrangeHRM
Before enabling auto-provisioning:
- ✅ Create all common job titles
- ✅ Set up organization structure (departments)
- ✅ Create employment statuses
- ✅ Test with one manual employee first

### 2. Naming Consistency
Keep names consistent between systems:
- Job titles: Use same wording
- Departments: Use same names
- Case doesn't matter (matching is case-insensitive)

### 3. Regular Audits
Periodically check:
```sql
-- Employees without OrangeHRM ID
SELECT * FROM employees
WHERE orangehrm_employee_id IS NULL;

-- Failed provisions
SELECT * FROM audit_logs
WHERE action = 'ORANGEHRM_EMPLOYEE_CREATION_FAILED'
AND timestamp > NOW() - INTERVAL '7 days';
```

### 4. Manual Verification
After enabling auto-provisioning:
1. Mark one candidate as hired
2. Check OrangeHRM immediately
3. Verify all fields populated
4. If issues, check console/audit logs
5. Fix OrangeHRM configuration
6. Continue with remaining hires

## Future Enhancements

### Possible Improvements
1. **Create Missing Entities**
   - Auto-create job titles if not found
   - Auto-create departments/sub-units
   - Requires additional OrangeHRM permissions

2. **Supervisor Assignment**
   - Map reporting manager to OrangeHRM supervisor
   - Requires supervisor lookup/matching

3. **Location Assignment**
   - Map work location to OrangeHRM location
   - Add office location data

4. **Salary Sync**
   - Push compensation to OrangeHRM salary component
   - Requires salary structure setup

5. **Custom Fields**
   - Sync additional employee data
   - Use OrangeHRM custom fields API

6. **Bulk Updates**
   - Background job to update existing employees
   - Sync changes when job details updated

## Related Documentation

- `ORANGEHRM_SETUP.md` - Initial setup guide
- `ORANGEHRM_PROVISIONING_FIX.md` - EmployeeId fix
- `HIRED_STATUS_FIX.md` - Notification and constraint fixes
- OrangeHRM API Docs: https://opensource.orangehrmlive.com/apidoc/
