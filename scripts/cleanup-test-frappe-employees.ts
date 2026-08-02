import "dotenv/config";
import { createFrappeClient } from "../src/integrations/frappe/client";

async function main() {
  const client = createFrappeClient();
  
  console.log("Fetching all employees...");
  const employees = await client.listEmployees(100, 0);
  
  console.log(`Found ${employees.length} employees\n`);
  
  // Find test employees
  const testEmployees = [];
  for (const emp of employees) {
    const full = await client.getEmployee(emp.name);
    if (full && (full.personal_email?.includes("test.employee") || full.employee_name?.includes("Test"))) {
      testEmployees.push(full);
    }
  }
  
  console.log(`Found ${testEmployees.length} test employees:\n`);
  
  for (const emp of testEmployees) {
    console.log(`- ${emp.name}: ${emp.employee_name} (${emp.status})`);
    console.log(`  Email: ${emp.personal_email}`);
    console.log(`  Status: ${emp.status}\n`);
  }
  
  if (testEmployees.length > 0) {
    console.log("\nCleaning up test employees...");
    for (const emp of testEmployees) {
      if (emp.status !== "Left") {
        await client.terminateEmployee(emp.name, new Date().toISOString().split('T')[0]);
        console.log(`✓ Marked ${emp.name} as Left`);
      } else {
        console.log(`○ ${emp.name} already Left`);
      }
    }
  }
  
  console.log("\nCleanup complete!");
}

main().catch(console.error);
