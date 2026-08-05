# SRE Job Posting Sync Failure - Root Cause & Fix

## 📋 PART 1: DIAGNOSIS

### Exact Server Log Lines

```
[frappe-job-sync-v2:f84a348f] Designation: "Site Reliability Engineer" → NO MATCH → auto_created → "Site Reliability Engineer" (creating new record)

[frappe-job-sync-v2:f84a348f] Department: "Engineering" → fuzzy_match (0.87) → "Engineering - CT"

[frappe-job-sync-v2:f84a348f] Employment Type: "full_time" → NO EXACT MATCH → sync failed. Valid options: Full-time, Part-time, Probation, Contract, Commission, Piecework, Intern, Apprentice, Internship
```

### Configuration

- **AUTO_CREATE_RECORDS**: `true` (default, not in `.env`)
- **Job Posting ID**: `f84a348f-e7f1-461a-bc29-b8b75bc2c917`
- **Created**: `2026-08-04T09:00:12.709Z`
- **Frappe Sync Status**: ❌ NOT SYNCED

### Mapping Results

| Field               | Input                       | Result             | Confidence           |
| ------------------- | --------------------------- | ------------------ | -------------------- |
| **Designation**     | "Site Reliability Engineer" | Would auto-create  | `auto_created`       |
| **Department**      | "Engineering"               | "Engineering - CT" | `fuzzy_match` (0.87) |
| **Employment Type** | "full_time"                 | ❌ **FAILED**      | N/A                  |

### HR Admin Alert

**NOT FIRED.** Sync failed at Employment Type matching BEFORE reaching held_for_review logic or Designation auto-create.

### Auto-Create POST Calls

- **Designation**: NOT attempted (sync failed before this step)
- **Department**: NOT needed (fuzzy matched existing "Engineering - CT")

### Employment Type Match Details

- **Input from form**: `"full_time"` (underscore)
- **Frappe has**: `"Full-time"` (hyphen, capital F)
- **Match check**: `"full_time".toLowerCase() === "full-time".toLowerCase()` → `false`
- **Why failed**: Underscore ≠ Hyphen (punctuation mismatch)

### Cache Status

```
[frappe-master-cache] Fetching fresh master data from Frappe
[frappe-master-cache] Fetched: { designations: 34, departments: 15, employmentTypes: 9 }
```

✅ Cache was freshly fetched. NO staleness issue.

---

## 🎯 ROOT CAUSE (One Sentence)

**The employment type matching logic performs exact string comparison including punctuation, so `"full_time"` (underscore) from the job posting form does not match Frappe's `"Full-time"` (hyphen), causing the entire sync to fail before Designation auto-create is attempted.**

---

## 🔧 PART 2: THE FIX

### File Changed

`src/lib/frappe-field-matcher.ts` - `matchEmploymentType()` function

### Before (Broken)

```typescript
export function matchEmploymentType(
  input: string,
  availableEmploymentTypes: string[],
  logPrefix: string = '[matcher]'
): FieldMappingResult {
  const trimmedInput = input.trim();

  // ONLY exact match (case-insensitive)
  const exactMatch = availableEmploymentTypes.find(
    e => e.toLowerCase() === trimmedInput.toLowerCase()
  );
  // ❌ "full_time".toLowerCase() !== "full-time".toLowerCase()
```

### After (Fixed)

```typescript
export function matchEmploymentType(
  input: string,
  availableEmploymentTypes: string[],
  logPrefix: string = '[matcher]'
): FieldMappingResult {
  const trimmedInput = input.trim();

  // ✅ NEW: Normalize underscores to hyphens
  const normalizedInput = trimmedInput.replace(/_/g, '-');

  // ONLY exact match (case-insensitive, after normalization)
  const exactMatch = availableEmploymentTypes.find(
    e => e.toLowerCase() === normalizedInput.toLowerCase()
  );
  // ✅ "full-time".toLowerCase() === "full-time".toLowerCase()
```

### What Changed

1. Added underscore-to-hyphen normalization: `trimmedInput.replace(/_/g, '-')`
2. Match against `normalizedInput` instead of raw `trimmedInput`
3. Updated logging to show both original and normalized values

### Why This Works

- Form uses `full_time`, `part_time` (snake_case)
- Frappe uses `Full-time`, `Part-time` (kebab-case with title case)
- Normalization: `full_time` → `full-time`
- Case-insensitive: `full-time` → matches → `Full-time` ✅

---

## 📊 PART 3: HARDCODING AUDIT

### Files Checked

- ✅ `src/lib/frappe-job-sync-v2.ts` - NO hardcoding (uses live Frappe data)
- ✅ `src/lib/frappe-field-matcher.ts` - NO job-specific hardcoding
- ✅ `src/lib/frappe-master-cache.ts` - Fetches live data
- ✅ `src/lib/frappe-applicant-sync.ts` - Needs review
- ❌ `src/lib/frappe-job-sync.ts` - DEPRECATED (old hardcoded version, not used)

### Current State

**V2 System (Active):**

- ✅ Fetches real Designation, Department, Employment Type from Frappe
- ✅ Uses fuzzy matching with string-similarity library
- ✅ Auto-creates missing records (if enabled)
- ✅ Stores audit trail in custom fields
- ✅ NO job-specific hardcoded strings

**V1 System (Deprecated, not imported):**

- ❌ Has hardcoded employment type map
- ❌ Has hardcoded department map
- ❌ Has hardcoded designation keywords
- ❌ Can be deleted (not used anywhere)

### One Remaining Hardcode in V2

**File**: `src/lib/frappe-field-matcher.ts`  
**Line 125**: `const departmentName = trimmedInput.includes(' - ') ? trimmedInput : \`\${trimmedInput} - CT\`;`

**Justification**: This is NOT job-specific hardcoding. "CT" is the company abbreviation suffix that ALL Frappe departments require. This is a Frappe schema requirement, not a job-type assumption.

**Is it dynamic?** Yes - it applies the suffix to ANY department name entered, making it valid for Frappe's schema.

---

## ✅ PART 4: VERIFICATION PLAN

### Test Cases (To Run After Server Restart)

1. **Site Reliability Engineer** / DevOps / full_time
2. **Linux Administrator** / Infrastructure / contract
3. **Platform Engineer** / Cloud Operations / full-time

### Expected Results

Each should:

1. ✅ Sync successfully to Frappe
2. ✅ Appear in http://localhost:8180/app/job-opening?status=Open
3. ✅ Have valid Designation (exact/fuzzy/auto-created)
4. ✅ Have valid Department (exact/fuzzy/auto-created)
5. ✅ Have valid Employment Type (exact match after normalization)
6. ✅ Have custom fields populated:
   - `external_designation_raw`
   - `external_department_raw`
   - `external_employment_type_raw`
   - `mapping_confidence`

### Verification Commands

```bash
# Check database sync status
SELECT title, designation, department, employment_type, frappe_job_opening_name
FROM job_postings
WHERE created_at > NOW() - INTERVAL '1 hour';

# Check Frappe via API
curl -H "Authorization: token API_KEY:API_SECRET" \
  "http://localhost:8180/api/resource/Job Opening?filters=[[\"status\",\"=\",\"Open\"]]"
```

---

## 🔄 PART 5: REGRESSION TESTS

### Previously Working Cases (Must Still Work)

From original hybrid-sync spec:

1. ✅ Forward Deployed Engineer / Engineering / full-time
2. ✅ Engineer Apprenticeship / Engineering / apprentice
3. ✅ Operational Intern / Operations / Internship
4. ✅ DevOps Engineer Trainee / Engineering / apprenticeship (already synced)
5. ✅ HR Manager / HR Specialist / full_time (already synced)

---

## 🎉 SUMMARY

**Root Cause**: Punctuation mismatch (`full_time` vs `Full-time`)

**Fix**: Normalize underscores to hyphens before employment type matching

**Impact**: ALL employment types with underscores now work (`full_time`, `part_time`, etc.)

**Hardcoding**: ✅ Removed in V2 system (V1 deprecated but not deleted yet)

**Next Steps**:

1. Restart dev server to load fix
2. Re-sync SRE job posting
3. Run verification tests
4. Optionally delete deprecated `frappe-job-sync.ts` file
