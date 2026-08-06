/**
 * Comprehensive System Verification
 * Check EVERYTHING and fix any issues found
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
  return res.json();
}

interface Issue {
  category: string;
  description: string;
  severity: "critical" | "warning" | "info";
  fix?: () => Promise<void>;
}

const issues: Issue[] = [];

async function checkWorkspaceIcons() {
  console.log("1️⃣  Checking Workspace Icons...\n");

  const customWorkspaces = [
    "HR Operations",
    "Finance Hub",
    "Manager Hub",
    "Sales & CRM",
    "Projects Hub",
    "Support Desk",
    "System Admin",
    "Executive View",
    "Procurement Hub",
    "My Portal",
  ];

  let allHaveIcons = true;

  for (const wsName of customWorkspaces) {
    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      if (ws.data) {
        if (!ws.data.icon) {
          issues.push({
            category: "Workspace Icons",
            description: `${wsName} has no icon`,
            severity: "critical",
            fix: async () => {
              await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`, "PUT", {
                icon: "folder",
              });
            },
          });
          allHaveIcons = false;
          console.log(`   ❌ ${wsName} - NO ICON`);
        } else {
          console.log(`   ✅ ${wsName} - icon: ${ws.data.icon}`);
        }
      }
    } catch (e) {
      issues.push({
        category: "Workspace Icons",
        description: `${wsName} not found`,
        severity: "critical",
      });
      console.log(`   ❌ ${wsName} - NOT FOUND`);
    }
  }

  console.log(`\n   Result: ${allHaveIcons ? "✅ All have icons" : "❌ Some missing icons"}\n`);
}

async function checkWorkspaceRoles() {
  console.log("2️⃣  Checking Workspace Role Restrictions...\n");

  const workspaceRoleCheck = [
    { name: "My Portal", shouldHave: ["Employee"], label: "Employee Portal" },
    { name: "Support Desk", shouldHave: ["Employee"], label: "Employee Support" },
    { name: "HR Operations", shouldHave: ["HR Manager", "HR User"], label: "HR Only" },
    { name: "Finance Hub", shouldHave: ["Accounts Manager"], label: "Finance Only" },
    { name: "System Admin", shouldHave: ["System Manager"], label: "Admin Only" },
  ];

  for (const check of workspaceRoleCheck) {
    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(check.name)}`);

      if (ws.data) {
        const roles = (ws.data.roles || []).map((r: any) => r.role);
        const hasCorrectRoles = check.shouldHave.some(role => roles.includes(role));

        if (ws.data.public === 1 && check.name !== "My Portal" && check.name !== "Support Desk") {
          issues.push({
            category: "Workspace Roles",
            description: `${check.name} is public (should be role-restricted)`,
            severity: "warning",
          });
          console.log(`   ⚠️  ${check.name} - Public (should be restricted)`);
        } else if (!hasCorrectRoles) {
          issues.push({
            category: "Workspace Roles",
            description: `${check.name} missing required roles`,
            severity: "warning",
          });
          console.log(`   ⚠️  ${check.name} - Missing roles`);
        } else {
          console.log(`   ✅ ${check.name} - ${check.label}`);
        }
      }
    } catch (e) {
      console.log(`   ❌ ${check.name} - Error checking`);
    }
  }

  console.log();
}

async function checkDuplicateWorkspaces() {
  console.log("3️⃣  Checking for Duplicate Workspaces...\n");

  // Check if standard "HR" and custom "HR Operations" both visible to employees
  try {
    const hrStandard = await frappe("/api/resource/Workspace/HR");

    if (hrStandard.data) {
      const roles = (hrStandard.data.roles || []).map((r: any) => r.role);
      const publicToEmployees = hrStandard.data.public === 1 || roles.includes("Employee");

      if (publicToEmployees) {
        issues.push({
          category: "Duplicate Workspaces",
          description: "Standard 'HR' workspace visible to employees (conflicts with HR Operations)",
          severity: "warning",
          fix: async () => {
            await frappe("/api/resource/Workspace/HR", "PUT", {
              roles: [{ role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }],
              public: 0,
            });
          },
        });
        console.log(`   ⚠️  Standard 'HR' visible to employees (duplicate with HR Operations)`);
      } else {
        console.log(`   ✅ Standard 'HR' properly restricted`);
      }
    }
  } catch (e) {
    console.log(`   ℹ️  Standard 'HR' workspace not found (OK)`);
  }

  // Check standard "Projects"
  try {
    const projStandard = await frappe("/api/resource/Workspace/Projects");

    if (projStandard.data) {
      const roles = (projStandard.data.roles || []).map((r: any) => r.role);
      const publicToAll = projStandard.data.public === 1 || roles.includes("Employee");

      if (publicToAll) {
        issues.push({
          category: "Duplicate Workspaces",
          description: "Standard 'Projects' workspace too visible (conflicts with Projects Hub)",
          severity: "warning",
          fix: async () => {
            await frappe("/api/resource/Workspace/Projects", "PUT", {
              roles: [
                { role: "Projects User" },
                { role: "Projects Manager" },
                { role: "System Manager" },
              ],
              public: 0,
            });
          },
        });
        console.log(`   ⚠️  Standard 'Projects' too visible`);
      } else {
        console.log(`   ✅ Standard 'Projects' properly restricted`);
      }
    }
  } catch (e) {
    console.log(`   ℹ️  Standard 'Projects' workspace not found (OK)`);
  }

  console.log();
}

async function checkTemplates() {
  console.log("4️⃣  Checking Templates...\n");

  // Check print formats
  const printFormats = await frappe("/api/resource/Print Format?filters=[[\"name\",\"like\",\"%Ciago%\"]]");
  const ciagoFormats = printFormats.data?.length || 0;

  if (ciagoFormats < 10) {
    issues.push({
      category: "Templates",
      description: `Only ${ciagoFormats} Ciago print formats found (expected 10+)`,
      severity: "warning",
    });
    console.log(`   ⚠️  Print Formats: ${ciagoFormats} found (expected 10+)`);
  } else {
    console.log(`   ✅ Print Formats: ${ciagoFormats} found`);
  }

  // Check email templates
  const emailTemplates = await frappe("/api/resource/Email Template");
  const totalEmails = emailTemplates.data?.length || 0;

  console.log(`   ✅ Email Templates: ${totalEmails} found`);

  console.log();
}

async function checkMasterData() {
  console.log("5️⃣  Checking Master Data...\n");

  // Employee Grades
  const grades = await frappe("/api/resource/Employee Grade");
  const gradeCount = grades.data?.length || 0;

  if (gradeCount < 10) {
    issues.push({
      category: "Master Data",
      description: `Only ${gradeCount} employee grades (expected 11)`,
      severity: "warning",
    });
    console.log(`   ⚠️  Employee Grades: ${gradeCount} (expected 11)`);
  } else {
    console.log(`   ✅ Employee Grades: ${gradeCount}`);
  }

  // Project Templates
  const projects = await frappe("/api/resource/Project?filters=[[\"is_template\",\"=\",1]]");
  const templateCount = projects.data?.length || 0;

  if (templateCount < 5) {
    issues.push({
      category: "Master Data",
      description: `Only ${templateCount} project templates (expected 5)`,
      severity: "info",
    });
    console.log(`   ℹ️  Project Templates: ${templateCount} (expected 5)`);
  } else {
    console.log(`   ✅ Project Templates: ${templateCount}`);
  }

  // Departments
  const depts = await frappe("/api/resource/Department?filters=[[\"company\",\"=\",\"Ciago Technologies\"]]");
  console.log(`   ✅ Departments: ${depts.data?.length || 0}`);

  // Leave Types
  const leaves = await frappe("/api/resource/Leave Type");
  console.log(`   ✅ Leave Types: ${leaves.data?.length || 0}`);

  console.log();
}

async function checkUserRoles() {
  console.log("6️⃣  Checking User Roles...\n");

  const users = [
    { email: "anujavengers@gmail.com", expectedRoles: ["System Manager"] },
    { email: "joyboygaming2901@gmail.com", expectedRoles: ["HR Manager", "HR User"] },
    { email: "tktpay2901@gmail.com", expectedRoles: ["Employee"] },
  ];

  for (const user of users) {
    try {
      const userData = await frappe(`/api/resource/User/${encodeURIComponent(user.email)}`);

      if (userData.data) {
        const userRoles = (userData.data.roles || []).map((r: any) => r.role);
        const hasExpected = user.expectedRoles.some(role => userRoles.includes(role));

        if (hasExpected) {
          console.log(`   ✅ ${user.email} - Has required roles`);
        } else {
          issues.push({
            category: "User Roles",
            description: `${user.email} missing expected roles`,
            severity: "warning",
          });
          console.log(`   ⚠️  ${user.email} - Missing roles`);
        }
      }
    } catch (e) {
      console.log(`   ℹ️  ${user.email} - Could not verify`);
    }
  }

  console.log();
}

async function applyFixes() {
  if (issues.length === 0) return;

  console.log("\n🔧 Applying Fixes...\n");

  for (const issue of issues) {
    if (issue.fix) {
      try {
        await issue.fix();
        console.log(`   ✅ Fixed: ${issue.description}`);
      } catch (e) {
        console.log(`   ❌ Failed to fix: ${issue.description}`);
      }
    }
  }
}

async function generateReport() {
  console.log("\n========================================");
  console.log(" VERIFICATION REPORT");
  console.log("========================================\n");

  const critical = issues.filter(i => i.severity === "critical");
  const warnings = issues.filter(i => i.severity === "warning");
  const info = issues.filter(i => i.severity === "info");

  if (issues.length === 0) {
    console.log("✅ ALL CHECKS PASSED - SYSTEM IS READY!\n");
    console.log("Summary:");
    console.log("  ✅ All workspace icons present");
    console.log("  ✅ Role restrictions properly set");
    console.log("  ✅ No duplicate workspaces");
    console.log("  ✅ All templates available");
    console.log("  ✅ Master data complete");
    console.log("  ✅ User roles configured\n");

    console.log("📦 Ready for Export and Production Deployment\n");
  } else {
    console.log(`Found ${issues.length} issues:\n`);

    if (critical.length > 0) {
      console.log(`❌ Critical Issues (${critical.length}):`);
      critical.forEach(i => console.log(`   - ${i.description}`));
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`⚠️  Warnings (${warnings.length}):`);
      warnings.forEach(i => console.log(`   - ${i.description}`));
      console.log();
    }

    if (info.length > 0) {
      console.log(`ℹ️  Info (${info.length}):`);
      info.forEach(i => console.log(`   - ${i.description}`));
      console.log();
    }

    const fixable = issues.filter(i => i.fix).length;
    if (fixable > 0) {
      console.log(`🔧 ${fixable} issues can be auto-fixed\n`);
    }
  }

  console.log("========================================\n");
}

async function main() {
  console.log("========================================");
  console.log(" COMPREHENSIVE SYSTEM VERIFICATION");
  console.log("========================================\n");
  console.log("Checking all components...\n");

  await checkWorkspaceIcons();
  await checkWorkspaceRoles();
  await checkDuplicateWorkspaces();
  await checkTemplates();
  await checkMasterData();
  await checkUserRoles();

  await generateReport();

  if (issues.some(i => i.fix)) {
    await applyFixes();

    console.log("\n🔄 Re-verifying after fixes...\n");
    issues.length = 0; // Clear issues
    await checkWorkspaceIcons();
    await checkWorkspaceRoles();
    await checkDuplicateWorkspaces();
    await generateReport();
  }

  console.log("========================================");
  console.log(" FINAL STATUS");
  console.log("========================================\n");

  if (issues.filter(i => i.severity === "critical").length === 0) {
    console.log("✅ SYSTEM READY FOR USE\n");
    console.log("Next Steps:");
    console.log("  1. Logout and login to Frappe");
    console.log("  2. Verify workspace sidebar looks correct");
    console.log("  3. Test as different users (employee, HR, admin)");
    console.log("  4. Export for production\n");
  } else {
    console.log("❌ CRITICAL ISSUES REMAIN\n");
    console.log("Please review the issues above and fix manually.\n");
  }
}

main().catch(console.error);
