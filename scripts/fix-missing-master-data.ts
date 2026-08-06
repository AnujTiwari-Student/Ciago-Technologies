/**
 * Fix Missing Master Data in Frappe
 * Creates: Employee Grades, Project Templates, ERPNext Settings, Workspace Icons
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function frappe(endpoint: string, method = "GET", body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok && (data.exc_type || data.exception)) {
      throw new Error(`${data.exc_type || 'Error'}: ${data._error_message || data.exception || text}`);
    }
    return data;
  } catch (e: any) {
    if (e.message?.includes(":")) throw e;
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
    return JSON.parse(text);
  }
}

async function exists(doctype: string, name: string): Promise<boolean> {
  try {
    const r = await frappe(`/api/resource/${doctype}/${encodeURIComponent(name)}`);
    return !!r.data;
  } catch {
    return false;
  }
}

async function create(doctype: string, data: any, label: string) {
  try {
    if (data.name && await exists(doctype, data.name)) {
      console.log(`  [skip] ${label}`);
      return;
    }
    await frappe(`/api/resource/${doctype}`, "POST", data);
    console.log(`  [created] ${label}`);
  } catch (e: any) {
    console.log(`  [error] ${label}: ${e.message?.substring(0, 100)}`);
  }
}

console.log("========================================");
console.log(" Fixing Missing Master Data");
console.log("========================================\n");

// ============================================================================
// 1. EMPLOYEE GRADES
// ============================================================================

console.log("1️⃣  Creating Employee Grades...");

const grades = [
  { name: "Entry Level", default_salary_structure: "" },
  { name: "Junior", default_salary_structure: "" },
  { name: "Mid-Level", default_salary_structure: "" },
  { name: "Senior", default_salary_structure: "" },
  { name: "Lead", default_salary_structure: "" },
  { name: "Principal", default_salary_structure: "" },
  { name: "Manager", default_salary_structure: "" },
  { name: "Senior Manager", default_salary_structure: "" },
  { name: "Director", default_salary_structure: "" },
  { name: "VP / Head", default_salary_structure: "" },
  { name: "C-Level", default_salary_structure: "" },
];

for (const grade of grades) {
  await create("Employee Grade", grade, grade.name);
}

// ============================================================================
// 2. PROJECT TEMPLATES
// ============================================================================

console.log("\n2️⃣  Creating Project Templates...");

const projectTemplates = [
  {
    project_name: "Software Development Project",
    company: "Ciago Technologies",
    is_template: 1,
    project_type: "Internal",
    priority: "Medium",
    project_template: "",
    expected_start_date: "2026-01-01",
    tasks: [
      { title: "Requirements Gathering", status: "Open", priority: "High" },
      { title: "Design & Architecture", status: "Open", priority: "High" },
      { title: "Development Sprint 1", status: "Open", priority: "Medium" },
      { title: "Development Sprint 2", status: "Open", priority: "Medium" },
      { title: "Testing & QA", status: "Open", priority: "High" },
      { title: "Deployment", status: "Open", priority: "High" },
      { title: "Documentation", status: "Open", priority: "Low" },
    ],
  },
  {
    project_name: "Client Onboarding",
    company: "Ciago Technologies",
    is_template: 1,
    project_type: "External",
    priority: "High",
    tasks: [
      { title: "Initial Meeting", status: "Open", priority: "High" },
      { title: "Requirements Documentation", status: "Open", priority: "High" },
      { title: "Contract Signing", status: "Open", priority: "High" },
      { title: "Project Kickoff", status: "Open", priority: "Medium" },
      { title: "Setup Development Environment", status: "Open", priority: "Medium" },
    ],
  },
  {
    project_name: "Employee Onboarding",
    company: "Ciago Technologies",
    is_template: 1,
    project_type: "Internal",
    priority: "High",
    tasks: [
      { title: "Send Welcome Email", status: "Open", priority: "High" },
      { title: "Setup Workstation", status: "Open", priority: "High" },
      { title: "Create Email & Accounts", status: "Open", priority: "High" },
      { title: "Assign Buddy/Mentor", status: "Open", priority: "Medium" },
      { title: "First Day Orientation", status: "Open", priority: "High" },
      { title: "Week 1 Check-in", status: "Open", priority: "Medium" },
      { title: "Month 1 Review", status: "Open", priority: "Medium" },
    ],
  },
  {
    project_name: "Marketing Campaign",
    company: "Ciago Technologies",
    is_template: 1,
    project_type: "Internal",
    priority: "Medium",
    tasks: [
      { title: "Campaign Strategy", status: "Open", priority: "High" },
      { title: "Content Creation", status: "Open", priority: "Medium" },
      { title: "Design Assets", status: "Open", priority: "Medium" },
      { title: "Launch Campaign", status: "Open", priority: "High" },
      { title: "Monitor Metrics", status: "Open", priority: "Medium" },
      { title: "Analyze Results", status: "Open", priority: "Medium" },
    ],
  },
  {
    project_name: "Infrastructure Setup",
    company: "Ciago Technologies",
    is_template: 1,
    project_type: "Internal",
    priority: "High",
    tasks: [
      { title: "Requirements Analysis", status: "Open", priority: "High" },
      { title: "Vendor Selection", status: "Open", priority: "High" },
      { title: "Server Provisioning", status: "Open", priority: "High" },
      { title: "Security Setup", status: "Open", priority: "High" },
      { title: "Monitoring Setup", status: "Open", priority: "Medium" },
      { title: "Documentation", status: "Open", priority: "Low" },
    ],
  },
];

for (const template of projectTemplates) {
  await create("Project", template, template.project_name);
}

// ============================================================================
// 3. UPDATE HR SETTINGS
// ============================================================================

console.log("\n3️⃣  Updating HR Settings...");

try {
  const hrSettings = await frappe("/api/resource/HR Settings/HR Settings");

  const updates = {
    retirement_age: 60,
    stop_birthday_reminders: 0,
    emp_created_by: "Naming Series",
    expense_approver_mandatory_in_expense_claim: 1,
    leave_approver_mandatory_in_leave_application: 1,
    encrypt_salary_slips_in_emails: 0,
    email_salary_slip_to_employee: 1,
  };

  await frappe("/api/resource/HR Settings/HR Settings", "PUT", updates);
  console.log("  [updated] HR Settings");
} catch (e: any) {
  console.log(`  [error] HR Settings: ${e.message}`);
}

// ============================================================================
// 4. UPDATE WORKSPACE ICONS
// ============================================================================

console.log("\n4️⃣  Adding Icons to Custom Workspaces...");

const workspaceIcons: Record<string, string> = {
  "HR Operations": "users",
  "Finance Hub": "dollar-sign",
  "Manager Hub": "briefcase",
  "Sales & CRM": "trending-up",
  "Projects Hub": "layers",
  "Support Desk": "life-buoy",
  "System Admin": "settings",
  "Executive View": "eye",
  "Procurement Hub": "shopping-cart",
  "My Portal": "user",
};

const workspaces = await frappe("/api/resource/Workspace?fields=[\"name\",\"icon\"]&limit_page_length=100");

for (const ws of workspaces.data || []) {
  if (workspaceIcons[ws.name] && !ws.icon) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        icon: workspaceIcons[ws.name],
      });
      console.log(`  [updated] ${ws.name} → ${workspaceIcons[ws.name]}`);
    } catch (e: any) {
      console.log(`  [error] ${ws.name}: ${e.message?.substring(0, 80)}`);
    }
  }
}

// ============================================================================
// 5. CREATE SAMPLE PAYROLL ENTRY (for August 2026)
// ============================================================================

console.log("\n5️⃣  Creating Sample Payroll Entry...");

try {
  const employees = await frappe("/api/resource/Employee?filters=[[\"status\",\"=\",\"Active\"]]&limit_page_length=10");

  if (employees.data && employees.data.length > 0) {
    const payrollEntry = {
      doctype: "Payroll Entry",
      company: "Ciago Technologies",
      payroll_frequency: "Monthly",
      start_date: "2026-08-01",
      end_date: "2026-08-31",
      posting_date: "2026-08-31",
      payment_account: "Cash - CT",
      cost_center: "Main - CT",
      currency: "INR",
    };

    await create("Payroll Entry", payrollEntry, "August 2026 Payroll");
  } else {
    console.log("  [skip] No active employees for payroll");
  }
} catch (e: any) {
  console.log(`  [info] Payroll entry: ${e.message?.substring(0, 100)}`);
}

// ============================================================================
// 6. UPDATE ERPNEXT SETTINGS FOR EMPLOYEES
// ============================================================================

console.log("\n6️⃣  Configuring ERPNext Settings...");

try {
  // Enable projects module
  await frappe("/api/method/frappe.desk.moduleview.toggle_desktop_icon", "POST", {
    module: "Projects",
    enable: 1,
  });
  console.log("  [enabled] Projects module");
} catch (e: any) {
  console.log(`  [info] Module settings: ${e.message?.substring(0, 80)}`);
}

// ============================================================================
// 7. CREATE JOB OPENING TEMPLATES
// ============================================================================

console.log("\n7️⃣  Creating Job Opening Templates...");

const jobTemplates = [
  {
    job_title: "Software Engineer",
    company: "Ciago Technologies",
    department: "Engineering - CT",
    designation: "Software Engineer",
    status: "Open",
    description: "We are looking for a talented Software Engineer to join our team.",
  },
  {
    job_title: "Senior Software Engineer",
    company: "Ciago Technologies",
    department: "Engineering - CT",
    designation: "Software Engineer", // Use existing designation
    status: "Open",
    description: "Seeking an experienced Senior Software Engineer.",
  },
  {
    job_title: "HR Specialist",
    company: "Ciago Technologies",
    department: "Human Resources - CT",
    designation: "HR Specialist",
    status: "Open",
    description: "Looking for an experienced HR Specialist.",
  },
];

for (const job of jobTemplates) {
  await create("Job Opening", job, job.job_title);
}

console.log("\n========================================");
console.log(" ✅ Fix Complete!");
console.log("========================================\n");

console.log("Summary:");
console.log(`  • Created ${grades.length} Employee Grades`);
console.log(`  • Created ${projectTemplates.length} Project Templates`);
console.log("  • Updated HR Settings");
console.log("  • Added Workspace Icons");
console.log("  • Created Sample Payroll Entry");
console.log(`  • Created ${jobTemplates.length} Job Opening Templates`);

console.log("\n💡 Refresh Frappe UI to see changes\n");
