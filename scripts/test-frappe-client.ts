#!/usr/bin/env bun
/**
 * Test Frappe client against live instance
 * Verifies API authentication and CRUD operations
 */

import { createFrappeClient, FrappeError } from "../src/integrations/frappe/client";

async function main() {
  console.log("🧪 Testing Frappe HR API Client\n");

  try {
    // Create client
    const client = createFrappeClient();
    console.log("✅ Client created");

    // Test authentication
    console.log("\n1️⃣ Testing authentication...");
    const user = await client.testAuth();
    console.log(`✅ Authenticated as: ${user}`);

    // List existing employees
    console.log("\n2️⃣ Listing employees...");
    const employees = await client.listEmployees();
    console.log(`✅ Found ${employees.length} employees:`);
    for (const emp of employees) {
      console.log(`   - ${emp.name}`);
    }

    // Get specific employee
    if (employees.length > 0) {
      console.log(`\n3️⃣ Getting employee ${employees[0].name}...`);
      const employee = await client.getEmployee(employees[0].name);
      if (employee) {
        console.log(`✅ Employee: ${employee.employee_name}`);
        console.log(`   Status: ${employee.status}`);
        console.log(`   DOJ: ${employee.date_of_joining}`);
        console.log(`   Company: ${employee.company}`);
      }
    }

    // Search by email
    console.log("\n4️⃣ Searching by email...");
    const search = await client.searchEmployeesByEmail("john.doe@personal.com");
    console.log(`✅ Found ${search.length} employees with that email`);

    // Create test employee
    console.log("\n5️⃣ Creating test employee...");
    const testEmployee = await client.createEmployee({
      first_name: "API",
      last_name: "Test",
      gender: "Other",
      date_of_birth: "1995-06-15",
      date_of_joining: "2024-06-01",
      company: "Ciago Technologies",
      personal_email: "api.test@example.com",
    });
    console.log(`✅ Created: ${testEmployee.name} (${testEmployee.employee_name})`);

    // Update employee
    console.log(`\n6️⃣ Updating employee ${testEmployee.name}...`);
    const updated = await client.updateEmployee(testEmployee.name, {
      cell_number: "+1234567890",
      current_address: "123 Test Street, Test City",
    });
    console.log(`✅ Updated: ${updated.employee_name}`);
    console.log(`   Mobile: ${updated.cell_number}`);
    console.log(`   Address: ${updated.current_address}`);

    // Get updated employee
    console.log(`\n7️⃣ Retrieving updated employee...`);
    const retrieved = await client.getEmployee(testEmployee.name);
    if (retrieved) {
      console.log(`✅ Retrieved: ${retrieved.employee_name}`);
      console.log(`   Mobile: ${retrieved.cell_number}`);
      console.log(`   Email: ${retrieved.personal_email}`);
      console.log(`   Address: ${retrieved.current_address}`);
    }

    console.log("\n✅ All tests passed!");

  } catch (error) {
    console.error("\n❌ Test failed:");
    if (error instanceof FrappeError) {
      console.error(`   Error type: ${error.excType}`);
      console.error(`   Status: ${error.statusCode}`);
      console.error(`   Message: ${error.message}`);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
