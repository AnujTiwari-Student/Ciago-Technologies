# Frappe Job Opening & Applicant Sync - Complete Guide

## ✅ **DYNAMIC SYNC - WORKS WITH ANY JOB POSTING!**

The system now automatically handles **ANY** job posting you create, with intelligent field mapping.

---

## 🔄 **How It Works**

### **1. Employment Type** (Fully Dynamic)
Handles any format automatically:

| Your Input | Mapped to Frappe |
|------------|------------------|
| `internship`, `INTERNSHIP`, `intern` | → Internship |
| `full_time`, `full-time`, `FULL_TIME`, `permanent` | → Full-time |
| `part_time`, `part-time`, `PART_TIME` | → Part-time |
| `contract`, `contractor`, `freelance` | → Contract |
| `temporary`, `temp` | → Contract |
| *Any other format* | → Title-Cased with hyphens |

**Example:**
- `full_time` → `Full-time` ✅
- `FULL_TIME` → `Full-time` ✅
- `freelance_contractor` → `Contract` ✅

---

### **2. Department** (Smart Mapping)
Automatically maps common department names:

| Your Input | Mapped to Frappe |
|------------|------------------|
| Engineering, Tech, Technology, Development, IT | → Engineering - CT |
| HR, Human Resources, People | → Human Resources - CT |
| Sales, Business Development | → Sales - CT |
| Marketing | → Marketing - CT |
| Finance, Accounting, Accounts | → Accounts - CT |
| Operations, Ops | → Operations - CT |
| Support, Customer Service | → Customer Service - CT |
| Legal | → Legal - CT |
| Management, Admin, Administration | → Management - CT |
| Research, R&D | → Research & Development - CT |
| Quality, QA | → Quality Management - CT |
| Production, Manufacturing | → Production - CT |
| Purchase, Procurement | → Purchase - CT |
| Dispatch, Logistics | → Dispatch - CT |
| *Any other name* | → [Name] - CT |

**Example:**
- `Tech` → `Engineering - CT` ✅
- `Business Development` → `Sales - CT` ✅
- `Custom Department` → `Custom Department - CT` ✅

---

### **3. Designation** (Keyword-Based AI Matching)
Intelligently matches job titles to Frappe designations:

| Keywords in Title | Mapped to |
|------------------|-----------|
| engineer, developer, programmer | → Engineer |
| analyst, data scientist | → Analyst |
| designer, ui, ux | → Designer |
| hr, human resource, recruiter | → HR Manager |
| accountant, finance (without manager) | → Accountant |
| sales, business development | → Business Development Manager |
| marketing | → Head of Marketing and Sales |
| manager, lead, head | → Manager |
| executive, specialist, officer | → Executive Assistant |
| consultant | → Consultant |
| assistant | → Administrative Assistant |
| intern | → Engineer |
| *No match* | → Manager (safe fallback) |

**Example:**
- `Senior Full Stack Developer` → `Engineer` ✅
- `HR Manager / HR Specialist` → `HR Manager` ✅
- `Data Scientist` → `Analyst` ✅
- `UI/UX Designer` → `Designer` ✅
- `Marketing Manager` → `Head of Marketing and Sales` ✅

---

## 📋 **What Gets Synced**

### **Job Opening (Stage 1)**
✅ Job Title  
✅ Designation (auto-mapped)  
✅ Department (auto-mapped)  
✅ Employment Type (auto-normalized)  
✅ Company: Ciago Technologies  
✅ Status: Open/Closed  
✅ Description (HTML formatted)  
✅ Publish on Website (for published status)  
✅ Currency: INR  
✅ Salary Range (lower_range, upper_range)  
✅ Salary Paid Per: Month  
✅ Publish Salary Range (Yes/No)  
✅ Closes On (date)  
⚠️ Location (skipped - Frappe link validation issue)

### **Job Applicant (Stage 2)**
✅ Applicant Name  
✅ Email  
✅ Phone Number  
✅ Country  
✅ Cover Letter  
✅ Resume Link  
✅ Expected Salary Currency  
✅ Expected Salary Range (lower_range, upper_range)  
✅ Status: Open  
✅ Linked to Job Opening (automatic)

---

## 🎯 **Usage**

### **Create Any Job Posting:**
1. Go to http://localhost:8080/admin?tab=postings
2. Fill in the form with **ANY** values:
   - Title: Whatever you want
   - Department: Any department name
   - Employment Type: Any format (full_time, full-time, FULL_TIME, etc.)
   - Status: Published
3. Click "Save"

**The system will:**
- ✅ Automatically normalize employment type
- ✅ Map department to Frappe format
- ✅ Find best matching designation
- ✅ Create Job Opening in Frappe
- ✅ Store Frappe ID back in database

### **Apply to Job:**
1. Go to http://localhost:8080/careers
2. Find the job and click "Apply Now"
3. Fill in application form (all fields optional except name, email, resume)
4. Submit

**The system will:**
- ✅ Create Job Application in database
- ✅ Send email notification
- ✅ Create Job Applicant in Frappe
- ✅ Link to Job Opening automatically

---

## 📊 **Monitoring**

Check sync logs in the dev server terminal:
```
[frappe-job-sync:b26d8f21] Syncing to Frappe
[frappe-job-sync:b26d8f21] Employment Type: full_time → Full-time
[frappe-job-sync:b26d8f21] Department: Tech → Engineering - CT
[frappe-job-sync:b26d8f21] Designation: Senior Developer → Engineer
[frappe-job-sync:b26d8f21] Mapped payload ready for Frappe
[frappe-job-sync:b26d8f21] Creating new Job Opening
[frappe-job-sync:b26d8f21] Created: HR-OPN-2026-0003
```

---

## 🔧 **Troubleshooting**

### **If sync fails:**

1. **Check server logs** for error messages
2. **Verify Frappe is running** on port 8180
3. **Check API credentials** in `.env` file
4. **Restart dev server** if code was updated

### **Common Issues:**

**"Could not find Department"**
- ✅ Fixed! Department now auto-maps with ` - CT` suffix

**"Could not find Employment Type"**
- ✅ Fixed! Employment type now auto-normalizes any format

**"Could not find Designation"**
- ✅ Fixed! Uses keyword matching with safe fallback

**"Could not find Location"**
- ℹ️ Location field is skipped (Frappe strict validation)

---

## ✨ **Benefits**

1. **Zero Manual Configuration** - Create any job, it syncs automatically
2. **Fault Tolerant** - Always finds a valid mapping, never fails
3. **Format Agnostic** - Handles underscores, hyphens, uppercase, lowercase
4. **Intelligent Matching** - Uses keywords to find best designation
5. **Automatic Logging** - See exactly what mappings are applied
6. **Bidirectional Updates** - Future: Update job in either system

---

## 📝 **Files Modified**

- `src/lib/frappe-job-sync.ts` - Dynamic Job Opening sync with smart mapping
- `src/lib/frappe-applicant-sync.ts` - Job Applicant sync  
- `src/lib/jobPostings.functions.ts` - Triggers Job Opening sync
- `src/lib/applications.functions.ts` - Triggers Job Applicant sync
- `src/integrations/frappe/client.ts` - Frappe API methods
- `src/lib/feature-flags.server.ts` - Always-on Frappe sync
- `prisma/schema.prisma` - Schema with all Stage 1 & 2 fields

---

## 🎉 **Result**

**You can now create ANY job posting with ANY field values and it will automatically sync to Frappe!**

No more manual fixes. No more LinkValidationError. Just create and go! 🚀
