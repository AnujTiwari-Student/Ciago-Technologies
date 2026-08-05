#!/usr/bin/env tsx
/**
 * Sync our data to OrangeHRM
 * Run: npx tsx scripts/sync-to-orangehrm.ts
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";
import { fullSyncToOrangeHRM } from "../src/lib/orangehrm-bulk-sync";
import { syncAllJobPostingsToOrangeHRM } from "../src/lib/orangehrm-job-sync";

// Load .env file
config();

async function main() {
  console.log("🚀 Starting sync to OrangeHRM...\n");

  try {
    const client = getOrangeHRMClient();

    // Step 1: Sync master data (departments, statuses, job titles)
    const results = await fullSyncToOrangeHRM(client);

    // Step 2: Sync job postings
    console.log("\n📋 Now syncing job postings...\n");
    const jobResults = await syncAllJobPostingsToOrangeHRM(client, {
      includeDraft: false, // Don't sync drafts
      includeArchived: false, // Don't sync archived
    });

    // Show summary
    let hasFailures = false;

    console.log("\n📊 FINAL SUMMARY");
    console.log("=".repeat(60));

    console.log("\n📁 Master Data:");
    console.log(
      `   Departments: ${results.departments.created} created, ${results.departments.existed} existed`,
    );
    console.log(
      `   Employment Statuses: ${results.employmentStatuses.created} created, ${results.employmentStatuses.existed} existed`,
    );
    console.log(
      `   Job Titles: ${results.jobTitles.created} created, ${results.jobTitles.existed} existed`,
    );

    console.log("\n📋 Job Postings:");
    console.log(`   Created: ${jobResults.created}`);
    console.log(`   Updated: ${jobResults.updated}`);
    console.log(`   Skipped: ${jobResults.skipped}`);

    if (results.departments.failed.length > 0) {
      console.log("\n❌ Failed to create departments:");
      results.departments.failed.forEach((name) => console.log(`   - ${name}`));
      hasFailures = true;
    }

    if (results.employmentStatuses.failed.length > 0) {
      console.log("\n❌ Failed to create employment statuses:");
      results.employmentStatuses.failed.forEach((name) => console.log(`   - ${name}`));
      hasFailures = true;
    }

    if (results.jobTitles.failed.length > 0) {
      console.log("\n❌ Failed to create job titles:");
      results.jobTitles.failed.forEach((name) => console.log(`   - ${name}`));
      hasFailures = true;
    }

    if (jobResults.failed.length > 0) {
      console.log("\n❌ Failed to sync job postings:");
      jobResults.failed.forEach((f) => console.log(`   - ${f.title}: ${f.error}`));
      hasFailures = true;
    }

    console.log("\n" + "=".repeat(60));

    if (hasFailures) {
      console.log("\n⚠️  Some items failed to sync. Check OrangeHRM permissions.");
      process.exit(1);
    } else {
      console.log("\n✅ All data synced successfully!");
      console.log("🎉 Your OrangeHRM is now fully synced with your system!\n");
    }
  } catch (error: any) {
    console.error("\n❌ Sync failed:", error.message);

    if (error.message.includes("authorization required")) {
      console.log("\n💡 Run: npx tsx scripts/orangehrm-auth.ts");
    }

    if (error.message.includes("credentials missing")) {
      console.log("\n💡 Check .env file for OrangeHRM credentials");
    }

    process.exit(1);
  }
}

main();
