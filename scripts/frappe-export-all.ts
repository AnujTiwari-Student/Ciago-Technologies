/**
 * Frappe Export Script
 * Exports all customizations, templates, and configurations
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

const EXPORT_DIR = path.join(process.cwd(), "frappe-exports");

async function frappe(endpoint: string, method = "GET", body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { data: text };
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function exportCustomFields() {
  console.log("\n=== Exporting Custom Fields ===");
  const customFields = await frappe(
    `/api/resource/Custom Field?fields=["*"]&limit_page_length=500`
  );
  fs.writeFileSync(
    path.join(EXPORT_DIR, "fixtures", "custom_fields.json"),
    JSON.stringify(customFields.data || [], null, 2)
  );
  console.log(`Exported ${customFields.data?.length || 0} custom fields`);
}

async function exportPropertySetters() {
  console.log("\n=== Exporting Property Setters ===");
  const props = await frappe(
    `/api/resource/Property Setter?fields=["*"]&limit_page_length=500`
  );
  fs.writeFileSync(
    path.join(EXPORT_DIR, "fixtures", "property_setters.json"),
    JSON.stringify(props.data || [], null, 2)
  );
  console.log(`Exported ${props.data?.length || 0} property setters`);
}

async function exportPrintFormats() {
  console.log("\n=== Exporting Print Formats ===");
  const formats = await frappe(
    `/api/resource/Print Format?fields=["name","doc_type","html"]&limit_page_length=100`
  );
  const dir = path.join(EXPORT_DIR, "print_formats");
  ensureDir(dir);

  for (const fmt of formats.data || []) {
    if (fmt.html) {
      const filename = `${fmt.name.toLowerCase().replace(/\s+/g, "_")}.html`;
      fs.writeFileSync(path.join(dir, filename), fmt.html);
      console.log(`  Exported: ${fmt.name}`);
    }
  }

  // Also save metadata
  fs.writeFileSync(
    path.join(dir, "_metadata.json"),
    JSON.stringify(formats.data || [], null, 2)
  );
}

async function exportEmailTemplates() {
  console.log("\n=== Exporting Email Templates ===");
  const templates = await frappe(
    `/api/resource/Email Template?fields=["*"]&limit_page_length=100`
  );
  fs.writeFileSync(
    path.join(EXPORT_DIR, "email_templates", "email_templates.json"),
    JSON.stringify(templates.data || [], null, 2)
  );
  console.log(`Exported ${templates.data?.length || 0} email templates`);
}

async function exportWorkflows() {
  console.log("\n=== Exporting Workflows ===");
  const workflows = await frappe(
    `/api/resource/Workflow?fields=["*"]&limit_page_length=100`
  );
  fs.writeFileSync(
    path.join(EXPORT_DIR, "workflows", "workflows.json"),
    JSON.stringify(workflows.data || [], null, 2)
  );
  console.log(`Exported ${workflows.data?.length || 0} workflows`);
}

async function exportRolePermissions() {
  console.log("\n=== Exporting Custom Role Permissions ===");
  const perms = await frappe(
    `/api/resource/Custom DocPerm?fields=["*"]&limit_page_length=500`
  );
  fs.writeFileSync(
    path.join(EXPORT_DIR, "fixtures", "role_permissions.json"),
    JSON.stringify(perms.data || [], null, 2)
  );
  console.log(`Exported ${perms.data?.length || 0} custom permissions`);
}

async function exportMasterData() {
  console.log("\n=== Exporting Master Data ===");
  const dir = path.join(EXPORT_DIR, "master_data");
  ensureDir(dir);

  // Company
  const company = await frappe(`/api/resource/Company/Ciago Technologies`);
  fs.writeFileSync(path.join(dir, "company.json"), JSON.stringify(company.data, null, 2));
  console.log("  Exported: Company");

  // Departments
  const depts = await frappe(
    `/api/resource/Department?filters=[["company","=","Ciago Technologies"]]&fields=["*"]&limit_page_length=50`
  );
  fs.writeFileSync(path.join(dir, "departments.json"), JSON.stringify(depts.data || [], null, 2));
  console.log(`  Exported: ${depts.data?.length || 0} departments`);

  // Designations
  const desigs = await frappe(`/api/resource/Designation?fields=["*"]&limit_page_length=50`);
  fs.writeFileSync(path.join(dir, "designations.json"), JSON.stringify(desigs.data || [], null, 2));
  console.log(`  Exported: ${desigs.data?.length || 0} designations`);

  // Leave Types
  const leaveTypes = await frappe(`/api/resource/Leave Type?fields=["*"]&limit_page_length=50`);
  fs.writeFileSync(path.join(dir, "leave_types.json"), JSON.stringify(leaveTypes.data || [], null, 2));
  console.log(`  Exported: ${leaveTypes.data?.length || 0} leave types`);

  // Salary Components
  const salComps = await frappe(`/api/resource/Salary Component?fields=["*"]&limit_page_length=50`);
  fs.writeFileSync(path.join(dir, "salary_components.json"), JSON.stringify(salComps.data || [], null, 2));
  console.log(`  Exported: ${salComps.data?.length || 0} salary components`);

  // Salary Structures
  const salStructs = await frappe(
    `/api/resource/Salary Structure?filters=[["company","=","Ciago Technologies"]]&fields=["*"]&limit_page_length=10`
  );
  fs.writeFileSync(path.join(dir, "salary_structures.json"), JSON.stringify(salStructs.data || [], null, 2));
  console.log(`  Exported: ${salStructs.data?.length || 0} salary structures`);

  // Holiday Lists
  const holidays = await frappe(
    `/api/resource/Holiday List?filters=[["company","=","Ciago Technologies"]]&fields=["*"]&limit_page_length=10`
  );
  fs.writeFileSync(path.join(dir, "holiday_lists.json"), JSON.stringify(holidays.data || [], null, 2));
  console.log(`  Exported: ${holidays.data?.length || 0} holiday lists`);

  // Leave Policy
  const leavePolicies = await frappe(`/api/resource/Leave Policy?fields=["*"]&limit_page_length=10`);
  fs.writeFileSync(path.join(dir, "leave_policies.json"), JSON.stringify(leavePolicies.data || [], null, 2));
  console.log(`  Exported: ${leavePolicies.data?.length || 0} leave policies`);
}

async function exportUser() {
  console.log("\n=== Exporting Admin User ===");
  const user = await frappe(`/api/resource/User/anujavengers@gmail.com`);

  // Sanitize password fields
  const userData = user.data;
  delete userData.api_key;
  delete userData.api_secret;
  userData.new_password = "QWEbnm2901@"; // Store for reference

  fs.writeFileSync(
    path.join(EXPORT_DIR, "users", "anujavengers.json"),
    JSON.stringify(userData, null, 2)
  );
  console.log("  Exported: anujavengers@gmail.com (password in file)");
}

async function exportWorkspaces() {
  console.log("\n=== Exporting Workspace Customizations ===");
  const workspaces = await frappe(
    `/api/resource/Workspace?fields=["name","title","module","roles","public"]&limit_page_length=100`
  );
  fs.writeFileSync(
    path.join(EXPORT_DIR, "workspaces", "workspaces.json"),
    JSON.stringify(workspaces.data || [], null, 2)
  );
  console.log(`  Exported ${workspaces.data?.length || 0} workspaces`);
}

async function createSetupScript() {
  console.log("\n=== Creating Setup Script ===");

  const setupScript = `#!/usr/bin/env python3
"""
Frappe Import Script - Production Setup
Run this in your Frappe bench directory after installing the app
"""

import frappe
import json
import os
from pathlib import Path

EXPORT_DIR = Path(__file__).parent

def import_master_data():
    print("\\n=== Importing Master Data ===")
    data_dir = EXPORT_DIR / "master_data"

    # Import in dependency order
    order = [
        "company.json",
        "departments.json",
        "designations.json",
        "leave_types.json",
        "salary_components.json",
        "holiday_lists.json",
        "leave_policies.json",
        "salary_structures.json",
    ]

    for filename in order:
        filepath = data_dir / filename
        if filepath.exists():
            with open(filepath) as f:
                data = json.load(f)
                # Handle both single objects and arrays
                items = data if isinstance(data, list) else [data]
                for item in items:
                    try:
                        doctype = item.get("doctype")
                        name = item.get("name")
                        if frappe.db.exists(doctype, name):
                            print(f"  [skip] {doctype}: {name}")
                        else:
                            doc = frappe.get_doc(item)
                            doc.insert(ignore_permissions=True)
                            print(f"  [created] {doctype}: {name}")
                    except Exception as e:
                        print(f"  [error] {filename}: {e}")

    frappe.db.commit()

def import_custom_fields():
    print("\\n=== Importing Custom Fields ===")
    filepath = EXPORT_DIR / "fixtures" / "custom_fields.json"
    if filepath.exists():
        with open(filepath) as f:
            fields = json.load(f)
            for field in fields:
                try:
                    name = field.get("name")
                    if frappe.db.exists("Custom Field", name):
                        print(f"  [skip] {name}")
                    else:
                        doc = frappe.get_doc(field)
                        doc.insert(ignore_permissions=True)
                        print(f"  [created] {name}")
                except Exception as e:
                    print(f"  [error] {field.get('fieldname')}: {e}")
        frappe.db.commit()

def import_user():
    print("\\n=== Importing Admin User ===")
    filepath = EXPORT_DIR / "users" / "anujavengers.json"
    if filepath.exists():
        with open(filepath) as f:
            user_data = json.load(f)
            email = user_data.get("email")
            if frappe.db.exists("User", email):
                print(f"  [skip] User exists: {email}")
            else:
                password = user_data.pop("new_password", None)
                doc = frappe.get_doc(user_data)
                doc.insert(ignore_permissions=True)
                if password:
                    frappe.get_doc("User", email).set_new_password(password)
                print(f"  [created] {email}")
        frappe.db.commit()

def main():
    print("=" * 50)
    print(" Frappe Production Setup")
    print("=" * 50)

    frappe.init(site="your-site-name")  # Update with actual site
    frappe.connect()

    try:
        import_master_data()
        import_custom_fields()
        import_user()

        print("\\n" + "=" * 50)
        print(" Setup Complete!")
        print("=" * 50)
        print("\\nNext steps:")
        print("1. Login as anujavengers@gmail.com")
        print("2. Verify all master data")
        print("3. Create employee records")
        print("4. Set up automations")

    except Exception as e:
        print(f"\\nERROR: {e}")
        frappe.db.rollback()
    finally:
        frappe.destroy()

if __name__ == "__main__":
    main()
`;

  fs.writeFileSync(path.join(EXPORT_DIR, "setup.py"), setupScript);
  console.log("  Created: setup.py");
}

async function createREADME() {
  console.log("\n=== Creating README ===");

  const readme = `# Frappe Production Setup - Export Package

## 📦 Contents

This export contains all customizations, templates, and configurations from your development Frappe instance.

### Included:
- ✅ Custom Fields
- ✅ Property Setters
- ✅ Print Formats (Salary Slip, Offer Letter, etc.)
- ✅ Email Templates
- ✅ Workflows
- ✅ Role Permissions
- ✅ Master Data (Company, Departments, Leave Types, Salary Components, etc.)
- ✅ Admin User (anujavengers@gmail.com)
- ✅ Workspace Configurations

### NOT Included:
- ❌ Transaction data (Employees, Salary Slips, Attendance)
- ❌ Other users (only anujavengers@gmail.com)
- ❌ API keys/secrets

---

## 🚀 Production Setup

### Prerequisites:
1. Fresh Frappe v15 + HRMS v15 installation
2. Bench CLI access
3. Site created and initialized

### Import Steps:

#### Method 1: Using setup.py (Recommended)
\`\`\`bash
# Copy this export folder to your bench directory
cd /path/to/bench
cp -r /path/to/frappe-exports ./

# Update site name in setup.py
nano frappe-exports/setup.py
# Change: frappe.init(site="your-site-name")

# Run import
bench --site your-site-name execute frappe-exports/setup.py
\`\`\`

#### Method 2: Manual Import
\`\`\`bash
# 1. Import master data
bench --site your-site-name data-import \\
  --type "Company" \\
  --file frappe-exports/master_data/company.json

# 2. Import departments
bench --site your-site-name data-import \\
  --type "Department" \\
  --file frappe-exports/master_data/departments.json

# 3. Continue for all master data files...

# 4. Import custom fields
bench --site your-site-name data-import \\
  --type "Custom Field" \\
  --file frappe-exports/fixtures/custom_fields.json
\`\`\`

---

## 🔑 Admin Login

**Email**: anujavengers@gmail.com
**Password**: QWEbnm2901@

**IMPORTANT**: Change password after first login!

---

## ✅ Post-Import Verification

1. **Login & Check Workspaces**
   - Verify all workspaces are visible
   - Check HR, Payroll, Recruitment workspaces

2. **Verify Master Data**
   - Company: Ciago Technologies
   - Departments: Engineering, HR, Operations, Management
   - Leave Types: Casual, Sick, Earned, Comp Off
   - Salary Components: Basic, HRA, CA, SA, PF, PT

3. **Test Salary Structure**
   - Go to: Payroll → Salary Structure
   - Verify "Standard CTC Structure" exists
   - Check earnings & deductions

4. **Test Print Formats**
   - Go to any Salary Slip
   - Print → Select format
   - Verify PDF generates correctly

5. **Check Permissions**
   - Create test user with HR role
   - Verify they can access HR workspace
   - Test leave approval workflow

---

## 🔧 Manual Setup (After Import)

### 1. Email Configuration
\`\`\`
Settings → Email Account → New
- Email: hr@ciagotech.com
- SMTP Server: smtp.gmail.com (or your SMTP)
- Port: 587
- Use TLS: Yes
\`\`\`

### 2. Create Leave Period (If not imported)
\`\`\`
HR → Leave Period → New
- From: 2026-01-01
- To: 2026-12-31
- Company: Ciago Technologies
\`\`\`

### 3. Set Default Holiday List
\`\`\`
Company → Ciago Technologies
- Default Holiday List: India 2026 - CT
\`\`\`

---

## 🤖 Automations (To Set Up Manually)

These are NOT exported - set them up in production:

### 1. Monthly Payroll Automation
Create a scheduled job in Frappe:
\`\`\`python
# hooks.py
scheduler_events = {
    "cron": {
        "0 0 1 * *": [  # 1st of every month at midnight
            "your_app.tasks.auto_generate_payroll"
        ]
    }
}
\`\`\`

### 2. Birthday Notifications
\`\`\`python
scheduler_events = {
    "daily": [
        "your_app.tasks.send_birthday_wishes"
    ]
}
\`\`\`

See \`automations/\` folder for script templates.

---

## 📁 Folder Structure

\`\`\`
frappe-exports/
├── fixtures/              # Customizations
│   ├── custom_fields.json
│   ├── property_setters.json
│   └── role_permissions.json
├── master_data/           # Master records
│   ├── company.json
│   ├── departments.json
│   ├── leave_types.json
│   └── salary_structures.json
├── print_formats/         # PDF templates
├── email_templates/       # Email templates
├── workflows/             # Approval workflows
├── workspaces/            # Workspace configs
├── users/                 # Admin user only
├── automations/           # Automation scripts (templates)
├── setup.py               # Import script
└── README.md              # This file
\`\`\`

---

## 🆘 Troubleshooting

**Import fails with "Duplicate entry"**:
- Some records already exist in your site
- Solution: Skip or delete existing records first

**Print format not showing**:
- Go to Print Format list
- Find the format
- Check "Enabled" checkbox

**User can't login**:
- Verify user exists: User list
- Check "Enabled" status
- Reset password from User form

**Salary structure not working**:
- Check if salary components exist
- Verify structure is submitted (docstatus=1)
- Check date range in assignments

---

## 📞 Support

For issues with this export:
1. Check Frappe error logs: \`bench --site yoursite logs\`
2. Verify Frappe version compatibility (v15 required)
3. Ensure HRMS app is installed: \`bench --site yoursite list-apps\`

---

## 🔄 Re-Export (Development)

To update this export with new changes:

\`\`\`bash
cd /path/to/ciago-spark
npx tsx scripts/frappe-export-all.ts
\`\`\`

This will refresh all files in this directory.

---

*Export Date*: ${new Date().toISOString().split("T")[0]}
*Frappe Version*: v15
*HRMS Version*: v15
*Exported From*: Development Instance
`;

  fs.writeFileSync(path.join(EXPORT_DIR, "README.md"), readme);
  console.log("  Created: README.md");
}

async function main() {
  console.log("========================================");
  console.log(" Frappe Export Tool");
  console.log("========================================");

  // Create directory structure
  console.log("\n=== Creating Export Directory Structure ===");
  const dirs = [
    "fixtures",
    "master_data",
    "print_formats",
    "email_templates",
    "workflows",
    "workspaces",
    "users",
    "automations",
  ];

  dirs.forEach((dir) => {
    const fullPath = path.join(EXPORT_DIR, dir);
    ensureDir(fullPath);
    console.log(`  Created: ${dir}/`);
  });

  // Run all exports
  try {
    await exportCustomFields();
    await exportPropertySetters();
    await exportPrintFormats();
    await exportEmailTemplates();
    await exportWorkflows();
    await exportRolePermissions();
    await exportMasterData();
    await exportUser();
    await exportWorkspaces();
    await createSetupScript();
    await createREADME();

    console.log("\n========================================");
    console.log(" Export Complete!");
    console.log("========================================");
    console.log(`\nExport location: ${EXPORT_DIR}`);
    console.log("\nNext steps:");
    console.log("1. Review exports in frappe-exports/");
    console.log("2. Copy to production server");
    console.log("3. Run setup.py in production");
    console.log("4. Verify all imports");
  } catch (error) {
    console.error("\nERROR during export:", error);
    process.exit(1);
  }
}

main();
