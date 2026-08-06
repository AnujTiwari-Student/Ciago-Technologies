/**
 * Login as each user and verify what they actually see
 * Uses Frappe session-based login to simulate real user experience
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;

async function loginAsUser(email: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr: email, pwd: password }),
    });

    const cookies = res.headers.get("set-cookie");
    if (res.ok && cookies) {
      // Extract sid cookie
      const sidMatch = cookies.match(/sid=([^;]+)/);
      if (sidMatch) return sidMatch[1];
    }

    const data = await res.json();
    if (!res.ok) {
      console.log(`   ❌ Login failed: ${data.message || res.status}`);
      return null;
    }

    return null;
  } catch (e: any) {
    console.log(`   ❌ Login error: ${e.message}`);
    return null;
  }
}

async function getVisibleWorkspaces(sid: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/method/frappe.desk.desktop.get_workspace_sidebar_items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sid=${sid}`,
      },
    });

    const data = await res.json();

    if (data.message && data.message.pages) {
      return data.message.pages.map((p: any) => p.name || p.title);
    }

    return [];
  } catch (e: any) {
    console.log(`   ❌ Error fetching workspaces: ${e.message}`);
    return [];
  }
}

async function logout(sid: string) {
  await fetch(`${baseUrl}/api/method/logout`, {
    method: "POST",
    headers: { Cookie: `sid=${sid}` },
  });
}

async function main() {
  console.log("========================================");
  console.log(" LOGIN & VERIFY AS EACH USER");
  console.log("========================================\n");

  const users = [
    { email: "anujavengers@gmail.com", password: "QWEbnm2901@", label: "ADMIN" },
    { email: "joyboygaming2901@gmail.com", password: "Welcome@2026", label: "HR" },
    { email: "tktpay2901@gmail.com", password: "Welcome@2026", label: "EMPLOYEE" },
  ];

  for (const user of users) {
    console.log(`\n👤 ${user.label} (${user.email})`);
    console.log("─".repeat(50));

    // Login
    console.log(`   Logging in...`);
    const sid = await loginAsUser(user.email, user.password);

    if (!sid) {
      // Try alternate password for admin
      if (user.email === "anujavengers@gmail.com") {
        console.log("   Trying alternate password...");
        const sid2 = await loginAsUser(user.email, "PLMqaz2901@");
        if (!sid2) {
          console.log("   ❌ Cannot login - skipping");
          continue;
        }
        // Use sid2
        const workspaces = await getVisibleWorkspaces(sid2);
        console.log(`\n   Visible Workspaces (${workspaces.length}):`);
        workspaces.forEach(ws => console.log(`      • ${ws}`));
        await logout(sid2);
        continue;
      }
      console.log("   ❌ Cannot login - skipping");
      continue;
    }

    // Get visible workspaces
    const workspaces = await getVisibleWorkspaces(sid);

    console.log(`\n   Visible Workspaces (${workspaces.length}):`);
    if (workspaces.length > 0) {
      workspaces.forEach(ws => console.log(`      • ${ws}`));
    } else {
      console.log("      ❌ NO WORKSPACES VISIBLE!");
    }

    // Verify expectations
    console.log(`\n   Verification:`);

    if (user.label === "ADMIN") {
      const customWs = ["HR Operations", "Finance Hub", "Manager Hub", "Sales & CRM", "Projects Hub", "Support Desk", "System Admin", "Executive View", "Procurement Hub", "My Portal"];
      const missing = customWs.filter(cw => !workspaces.some(w => w === cw));

      if (missing.length === 0) {
        console.log("      ✅ Admin sees ALL custom workspaces");
      } else {
        console.log(`      ❌ Admin MISSING: ${missing.join(", ")}`);
      }
    }

    if (user.label === "HR") {
      const shouldSee = ["My Portal", "Support Desk", "HR Operations", "Manager Hub"];
      const shouldNotSee = ["System Admin", "Executive View"];

      const missing = shouldSee.filter(s => !workspaces.some(w => w === s));
      const wronglyVisible = shouldNotSee.filter(s => workspaces.some(w => w === s));

      if (missing.length === 0) {
        console.log(`      ✅ HR sees required workspaces`);
      } else {
        console.log(`      ❌ HR MISSING: ${missing.join(", ")}`);
      }

      if (wronglyVisible.length > 0) {
        console.log(`      ⚠️  HR sees admin-only: ${wronglyVisible.join(", ")}`);
      }
    }

    if (user.label === "EMPLOYEE") {
      const shouldSee = ["My Portal", "Support Desk"];
      const shouldNotSee = ["HR Operations", "Finance Hub", "System Admin", "Executive View"];

      const missing = shouldSee.filter(s => !workspaces.some(w => w === s));
      const wronglyVisible = shouldNotSee.filter(s => workspaces.some(w => w === s));

      if (missing.length === 0) {
        console.log(`      ✅ Employee sees required workspaces`);
      } else {
        console.log(`      ❌ Employee MISSING: ${missing.join(", ")}`);
      }

      if (wronglyVisible.length > 0) {
        console.log(`      ❌ Employee sees restricted: ${wronglyVisible.join(", ")}`);
      } else {
        console.log(`      ✅ Employee does NOT see restricted workspaces`);
      }
    }

    // Logout
    await logout(sid);
  }

  console.log("\n\n========================================");
  console.log(" VERIFICATION COMPLETE");
  console.log("========================================\n");
}

main().catch(console.error);
