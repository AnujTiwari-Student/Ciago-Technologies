# OrangeHRM Sync - Quick Reference

## ⚡ Quick Commands

### Sync Everything (Recommended)
```bash
npx tsx scripts/sync-to-orangehrm.ts
```
Syncs: Departments, Employment Statuses, Job Titles, **Job Postings**

### Check What's in OrangeHRM
```bash
npx tsx scripts/test-orangehrm-data.ts
```

### Re-authenticate
```bash
npx tsx scripts/orangehrm-auth.ts
```

## 📊 What Gets Synced

| Data Type | When | Details |
|-----------|------|---------|
| **Departments** | Manual sync | All departments from database |
| **Employment Statuses** | Manual sync | Full-Time, Part-Time, Intern, Contract |
| **Job Titles** | Manual sync + On hire | From job postings |
| **Job Postings** | Manual sync | **Complete details including salary, requirements, status** |
| **Employees** | On hire | Auto-provisioned with full details |

## 🎯 Complete Job Posting Sync

### What's Included
✅ Job title & description  
✅ Requirements & qualifications  
✅ **Salary range (min/max in INR)**  
✅ Department & location  
✅ Employment type  
✅ **Status (Draft/Published/Closed)**  
✅ Remote/On-site indicator  
✅ Internal-only flag  
✅ Skills & tags

### Status Mapping
```
draft      → Not visible (closed)
published  → Active + Published (public or internal based on flag)
closed     → Closed/Inactive
```

## 🔄 Typical Workflow

### First Time Setup
```bash
# 1. Authenticate
npx tsx scripts/orangehrm-auth.ts

# 2. Sync everything
npx tsx scripts/sync-to-orangehrm.ts

# 3. Verify
npx tsx scripts/test-orangehrm-data.ts
```

### When Creating a Job
```bash
# 1. Create job posting in your system
# 2. Set all details (title, description, salary, requirements, etc.)
# 3. Set status to "published"
# 4. Sync
npx tsx scripts/sync-to-orangehrm.ts

# Job vacancy created in OrangeHRM with ALL details!
```

### When Hiring
```bash
# 1. Mark candidate as "hired" in your system
# 2. System automatically:
#    - Creates employee in OrangeHRM
#    - Assigns job title
#    - Assigns employment status
#    - Assigns department
#    - Sets email, join date, etc.
```

### When Updating a Job
```bash
# 1. Update job posting in your system
# 2. Re-sync
npx tsx scripts/sync-to-orangehrm.ts

# Existing vacancy updated in OrangeHRM!
```

## ❌ Common Issues

### "OrangeHRM authorization required"
```bash
npx tsx scripts/orangehrm-auth.ts
```

### "403 Forbidden" or "401 Unauthorized"
- Check OrangeHRM user has **Admin** role
- Re-authenticate with admin credentials

### "Job vacancy not showing"
- Check status is `published` (not `draft`)
- Verify sync completed without errors
- Check user has Recruitment module access

### "Salary not formatted correctly"
- Ensure `salaryMinInr` and `salaryMaxInr` are **numbers** in database
- Format: "₹20,00,000 - ₹35,00,000"

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/lib/orangehrm-job-sync.ts` | Job posting sync logic |
| `src/lib/orangehrm-bulk-sync.ts` | Master data sync |
| `src/lib/orangehrm-sync.ts` | Employee provisioning |
| `src/integrations/orangehrm/client.ts` | API client |
| `scripts/sync-to-orangehrm.ts` | Sync script |
| `scripts/test-orangehrm-data.ts` | Verification script |

## 🎉 Complete Integration Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. CREATE JOB POSTING (Your System)                    │
│    - Title, description, requirements                   │
│    - Salary range, location                            │
│    - Status: draft → published                         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 2. SYNC TO ORANGEHRM                                   │
│    npx tsx scripts/sync-to-orangehrm.ts               │
│    ✅ Job vacancy created with ALL details            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 3. RECEIVE APPLICATIONS (Your System)                  │
│    - Candidates apply                                   │
│    - Track interview process                            │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 4. MARK AS HIRED (Your System)                        │
│    - Change candidate status to "hired"                 │
│    ✅ Auto-creates employee in OrangeHRM               │
│    ✅ Full details: job title, dept, status, email     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ 5. EMPLOYEE READY (OrangeHRM)                          │
│    ✅ Complete profile                                 │
│    ✅ Assigned to correct job/department               │
│    ✅ Ready for onboarding                             │
└─────────────────────────────────────────────────────────┘
```

## 📚 Full Documentation

- **`ORANGEHRM_AUTO_SYNC.md`** - Overview and setup
- **`ORANGEHRM_JOB_POSTING_SYNC.md`** - Detailed job posting sync guide
- **`ORANGEHRM_FULL_PROVISIONING.md`** - Employee provisioning details
- **`ORANGEHRM_DEBUG_GUIDE.md`** - Troubleshooting

## 💡 Tips

✅ **Run sync after creating multiple jobs** - More efficient than one-by-one  
✅ **Use draft status** - Keep jobs hidden until ready  
✅ **Set salary ranges** - Shows in OrangeHRM job description  
✅ **Add detailed requirements** - All get synced to OrangeHRM  
✅ **Use internal_only flag** - Control public vs internal visibility  
✅ **Monitor console logs** - See what's being created/updated  
✅ **Re-sync anytime** - Safe to run multiple times  

## 🚀 Success Criteria

After running sync, verify:

- [ ] All departments exist in OrangeHRM
- [ ] All employment statuses exist
- [ ] All job titles exist
- [ ] **All published job postings are visible as vacancies**
- [ ] **Job descriptions include salary, requirements, location**
- [ ] **Draft jobs are NOT visible**
- [ ] When hiring, employees get full details automatically
- [ ] No manual data entry needed in OrangeHRM

## Need Help?

1. Check console output for specific errors
2. Run `npx tsx scripts/test-orangehrm-data.ts` to see current state
3. Review detailed docs for specific features
4. Verify OrangeHRM version is 5.0+
5. Ensure API user has Admin permissions
