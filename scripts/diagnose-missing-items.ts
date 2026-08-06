/**
 * Diagnose what's missing in Frappe setup
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
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function diagnose() {
  console.log("========================================");
  console.log(" Diagnosing Frappe Setup Issues");
  console.log("========================================\n");

  // 1. Check Project Templates
  console.log("1️⃣  Checking Project Templates...");
  const projects = await frappe("/api/resource/Project?fields=[\"name\",\"is_template\"]&limit_page_length=100");
  const projectTemplates = projects.data?.filter((p: any) => p.is_template === 1) || [];
  console.log(`   Found: ${projectTemplates.length} project templates`);
  if (projectTemplates.length === 0) {
    console.log("   ❌ NO PROJECT TEMPLATES FOUND");
  }

  // 2. Check Employee Grades
  console.log("\n2️⃣  Checking Employee Grades...");
  const grades = await frappe("/api/resource/Employee Grade?limit_page_length=100");
  console.log(`   Found: ${grades.data?.length || 0} employee grades`);
  if (!grades.data || grades.data.length === 0) {
    console.log("   ❌ NO EMPLOYEE GRADES FOUND");
  } else {
    grades.data.forEach((g: any) => console.log(`      - ${g.name}`));
  }

  // 3. Check Payroll Entry
  console.log("\n3️⃣  Checking Payroll Entries...");
  const payroll = await frappe("/api/resource/Payroll Entry?limit_page_length=5");
  console.log(`   Found: ${payroll.data?.length || 0} payroll entries`);

  // 4. Check HR Settings
  console.log("\n4️⃣  Checking HR Settings...");
  const hrSettings = await frappe("/api/resource/HR Settings/HR Settings");
  if (hrSettings.data) {
    console.log(`   Employee created by: ${hrSettings.data.emp_created_by || "Not Set"}`);
    console.log(`   Retirement age: ${hrSettings.data.retirement_age || "Not Set"}`);
    console.log(`   Stop birthday reminders: ${hrSettings.data.stop_birthday_reminders || 0}`);
  }

  // 5. Check Workspaces with icons
  console.log("\n5️⃣  Checking Custom Workspaces...");
  const workspaces = await frappe("/api/resource/Workspace?fields=[\"name\",\"icon\",\"public\"]&filters=[[\"module\",\"=\",\"\"]]&limit_page_length=100");
  console.log(`   Total custom workspaces: ${workspaces.data?.length || 0}`);
  const noIcon = workspaces.data?.filter((w: any) => !w.icon) || [];
  if (noIcon.length > 0) {
    console.log(`   ❌ ${noIcon.length} workspaces WITHOUT icons:`);
    noIcon.forEach((w: any) => console.log(`      - ${w.name}`));
  }

  // 6. Check all roles available
  console.log("\n6️⃣  Checking Available Roles...");
  const roles = await frappe("/api/resource/Role?limit_page_length=200");
  console.log(`   Total roles: ${roles.data?.length || 0}`);
  const hrRoles = roles.data?.filter((r: any) =>
    r.name.includes("HR") ||
    r.name.includes("Employee") ||
    r.name.includes("Manager") ||
    r.name.includes("Leave") ||
    r.name.includes("Expense")
  ) || [];
  console.log(`   HR-related roles: ${hrRoles.length}`);
  hrRoles.forEach((r: any) => console.log(`      - ${r.name}`));

  // 7. Check Project doctype settings
  console.log("\n7️⃣  Checking Project Module Access...");
  const projectPerms = await frappe("/api/resource/DocPerm?filters=[[\"parent\",\"=\",\"Project\"]]&limit_page_length=100");
  console.log(`   Project permissions: ${projectPerms.data?.length || 0}`);

  console.log("\n========================================");
  console.log(" Summary of Issues");
  console.log("========================================\n");

  const issues = [];
  if (projectTemplates.length === 0) issues.push("❌ No Project Templates");
  if (!grades.data || grades.data.length === 0) issues.push("❌ No Employee Grades");
  if (noIcon.length > 0) issues.push(`❌ ${noIcon.length} workspaces missing icons`);

  if (issues.length > 0) {
    console.log("Issues Found:");
    issues.forEach(i => console.log(`  ${i}`));
    console.log("\n💡 Run fix script to resolve these issues");
  } else {
    console.log("✅ All checks passed!");
  }

  console.log("\n========================================\n");
}

diagnose().catch(console.error);
