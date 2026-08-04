# Frappe HR — Job Opening & Job Application Field Reference

Source: screenshots of live Frappe HR / ERPNext v15 instance (localhost:8180/8180).

Two distinct things covered here — do not treat as one form:
- **Job Opening** — a standard doctype form (internal-facing, HR module)
- **Job Application** — a **Web Form** (public-facing) that writes into the
  `Job Applicant` doctype, not a doctype of its own

---

## Doctype: Job Opening

### Top-level
| Field | Type | Required | Notes |
|---|---|---|---|
| Job Opening Template | Link | No | |
| Job Title | Data | Yes | |
| Designation | Link | Yes | |
| Status | Select | No | Default: Open |
| Posted On | Datetime | No | ⚠️ shown with America/New_York timezone — verify site timezone config |
| Closes On | Date | No | If set, auto-closes the opening after this date |

### Company Details
| Field | Type | Required | Notes |
|---|---|---|---|
| Company | Link | Yes | |
| Employment Type | Link | No | |
| Department | Link | No | |
| Location | Link | No | |

### Publishing
| Field | Type | Notes |
|---|---|---|
| Publish on website | Check | |
| Description | Text Editor (rich text) | "Job profile, qualifications required etc." |

### Salary
| Field | Type | Notes |
|---|---|---|
| Currency | Link | ⚠️ defaults to USD — verify/fix before use |
| Salary Paid Per | Select | Default: Month |
| Lower Range | Currency | |
| Upper Range | Currency | |
| Publish Salary Range | Check | |

---

## Web Form: Job Application (→ Job Applicant doctype)

Route: `job_application` · Module: HR · Target DocType: `Job Applicant` · Is Standard: Yes

| # | Field (fieldname) | Fieldtype | Custom Label | Mandatory | Options | Notes |
|---|---|---|---|---|---|---|
| 1 | Job Title | Data | Job Opening | No | — | ⚠️ Labeled "Job Opening" but typed as plain Data, not Link — should likely be a Link to Job Opening. As-is, no validation against real openings. |
| 2 | Applicant Name | Data | Applicant Name | **Yes** | — | |
| 3 | Email Id | Data | Email Address | **Yes** | Email | |
| 4 | Phone Number | Data | Phone Number | No | Phone | |
| 5 | Country | Link | Country of Residence | No | Country | |
| 6 | Cover Letter | Text | Cover Letter | No | — | |
| 7 | Resume Link | Data | Resume Link | No | — | |
| 8 | Resume Attachment | Attach | Resume Attachment | No | — | |
| 9 | *(Section Break)* | Section Break | Expected Salary Rang... | Yes* | — | ⚠️ Mandatory checkbox on a Section Break — layout element, not a real field. Likely misconfigured, not an intentional requirement. |
| 10 | Currency | Link | Currency | No | Currency | |
| 11 | *(Column Break)* | Column Break | — | No | — | layout only |
| 12 | Lower Range | Currency | Lower Range | No | currency | |
| 13 | *(Column Break)* | Column Break | — | No | — | layout only |
| 14 | Upper Range | Currency | Upper Range | No | currency | |
| 15 | *(Section Break)* | Section Break | Details | No | — | layout only |
| 16 | *(Column Break 3)* | Column Break | — | No | — | layout only |
| 17 | Designation | Link | Designation | No | Designation | |
| 18 | Status | Select | Status | **Yes** | Open, Replied, ... (truncated) | Get full option list from the doctype before migrating |
| 19 | *(Section Break)* | Section Break | Source and Rating | No | — | layout only |
| 20 | Source | Link | Source | No | Job Applicant Source | |
| 21 | Source Name | Link | Source Name | No | Employee | Points to Employee doctype — used when source is an internal referral |
| 22 | Employee Referral | Link | Employee Referral | No | Employee Referral | |
| 23 | *(Column Break 13)* | Column Break | — | No | — | layout only |
| 24 | Applicant Rating | Rating | Applicant Rating | No | — | |
| 25 | *(Section Break 6)* | Section Break | Resume | No | — | layout only |
| 26 | Notes | Data | Notes | No | — | |
| 27 | *(Section Break 16)* | Section Break | Salary Expectation | No | — | layout only |
| 28 | *(Column Break 18)* | Column Break | — | No | — | layout only |

**True mandatory fields for a job application submission:** Applicant Name, Email Id, Status.
(Status being mandatory on a public web form is odd — confirm whether applicants are meant
to set their own status, or whether this should be system-set on submission and hidden
from the public form.)

---

## Open items

1. Confirm whether "Job Title" (row 1) should be converted to a Link field pointing at
   Job Opening — recommend fixing this in Frappe before building any migration/import
   logic that depends on applications being tied to real openings.
2. Confirm site timezone setting — Posted On defaulting to America/New_York suggests the
   site-wide timezone may not match your actual location.
3. Get the full Status option list (truncated in screenshot: "Open, Replied, ...").
4. Decide whether the Section Break mandatory flag on row 9 is a bug to fix or leave alone.
5. No mapping to OrangeHRM recruitment/job-posting fields yet — still blocked on OrangeHRM
   source field list, same as the Employee mapping.
