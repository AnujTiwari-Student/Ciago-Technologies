# Frappe Job Opening Sync V2 - Intelligent Matching

## ✅ **IMPLEMENTED**

Replaced hardcoded keyword-matching with a hybrid approach that fetches real Frappe data and uses intelligent matching.

---

## 🎯 **Key Features**

### **1. Audit Trail Custom Fields**
Added to Frappe Job Opening doctype:
- `external_designation_raw` - Original job title as typed by recruiter
- `external_department_raw` - Original department as typed by recruiter  
- `external_employment_type_raw` - Original employment type as entered
- `mapping_confidence` - How the mapping was determined (exact_match/fuzzy_match/auto_created/held_for_review)

### **2. Live Frappe Master Data**
- Fetches real Designation, Department, and Employment Type records from Frappe
- 5-minute cache TTL to avoid hammering the API
- **No more hardcoded mappings that drift out of sync!**

### **3. Intelligent Matching Priority**

#### **For Designation & Department:**
1. **Exact Match** (case-insensitive) → `confidence: exact_match`
2. **Fuzzy Match** (≥75% similarity via string-similarity library) → `confidence: fuzzy_match`
3. **Auto-Create** (if `AUTO_CREATE_RECORDS ≠ false`) → `confidence: auto_created`
4. **Hold for Review** (if `AUTO_CREATE_RECORDS = false`) → `confidence: held_for_review` + alert

#### **For Employment Type (Closed Set):**
- **ONLY Exact Match** (case-insensitive)
- **NO fuzzy matching**
- **NO auto-create**
- **Sync fails with clear error listing valid options**

### **4. Never Silently Mislabels**
- No more "Site Reliability Engineer" → guessed as "Engineer"
- No more "apprenticeship" → wrongly formatted as "Apprenticeship" instead of "Apprentice"
- Every mapping decision is logged with confidence level
- Original values preserved in audit trail

---

## 📋 **What Was Removed**

❌ Deleted hardcoded `EMPLOYMENT_TYPE_MAP`  
❌ Deleted hardcoded `DEPARTMENT_MAP`  
❌ Deleted hardcoded `DESIGNATION_KEYWORD_MAP`  
❌ Deleted "safe fallback → Manager" logic  
❌ Deleted "Title-Cased with hyphens" employment type fallback

---

## 🔧 **Configuration**

### **Environment Variable**
```
AUTO_CREATE_RECORDS=true   # Default: auto-create missing designations/departments
AUTO_CREATE_RECORDS=false  # Hold for review, send alert to HR admin
```

### **Master Data Cache**
- TTL: 5 minutes
- Cleared automatically on stale data
- Can be manually cleared via `clearMasterDataCache()`

---

## 📊 **Logging Format**

New detailed logging shows exactly how each field was mapped:

```
[frappe-job-sync-v2:b26d8f21] Designation: "Site Reliability Engineer" → fuzzy_match (0.81) → "Engineer"

[frappe-job-sync-v2:f0ce1acd] Department: "DevOps" → auto_created → "DevOps - CT" (new record created)

[frappe-job-sync-v2:ea59fac2] Employment Type: "apprenticeship" → NO EXACT MATCH → sync failed
Valid options: Full-time, Part-time, Contract, Internship, Apprentice
```

---

## 🧪 **Test Cases**

Run: `node test-intelligent-matching.mjs`

Tests these scenarios:
1. **Site Reliability Engineer / DevOps** - Tests fuzzy matching and auto-create
2. **Linux Administrator / Infrastructure** - Tests novel designation
3. **Forward Deployed Engineer / Engineering** - Tests exact department match
4. **Engineer Apprenticeship / apprentice** - Tests exact employment type match
5. **Operational Intern / Operations** - Tests fuzzy department match
6. **Quantum Computing Specialist / Research** - Tests completely novel title/dept

---

## ✅ **Benefits**

1. **Never Drifts Out of Sync** - Uses real Frappe data, not hardcoded lists
2. **Preserves Intent** - Original values stored in audit trail
3. **Intelligent but Safe** - Fuzzy matching with confidence threshold
4. **Fail-Fast for Employment Types** - No guessing on closed set
5. **Transparent** - Every decision logged with confidence level
6. **Flexible** - Auto-create or hold-for-review based on policy

---

## 📁 **Files Changed**

### **New Files:**
- `src/lib/frappe-master-cache.ts` - Fetch & cache Frappe master data
- `src/lib/frappe-field-matcher.ts` - Intelligent matching logic
- `src/lib/frappe-job-sync-v2.ts` - New sync implementation
- `test-intelligent-matching.mjs` - Comprehensive test suite

### **Modified Files:**
- `src/lib/jobPostings.functions.ts` - Use V2 sync
- `src/integrations/frappe/client.ts` - Added master data API methods

### **Deprecated Files:**
- `src/lib/frappe-job-sync.ts` - Old hardcoded sync (kept for reference)

---

## 🔄 **Migration**

The system automatically uses V2 sync for all new job postings.

Existing jobs can be re-synced manually if needed to populate audit trail fields.

---

## 🎉 **Result**

**No more silent mislabeling. No more out-of-sync mappings. Complete audit trail.**

Every job posting is intelligently matched against real Frappe data, with full transparency about how the decision was made.
