#!/usr/bin/env tsx
/**
 * Create a test job posting for OrangeHRM sync verification
 */

import { config } from "dotenv";
import { getAdminDb } from "../src/lib/db/admin";

config();

async function main() {
  console.log("📝 Creating test job posting...\n");

  const adminDb = getAdminDb();

  // Check if test job already exists
  const existing = await adminDb.jobPosting.findFirst({
    where: { title: "Senior Backend Engineer - Test" },
  });

  if (existing) {
    console.log("⚠️  Test job already exists (ID: " + existing.id + ")");
    console.log("Updating instead...\n");

    const updated = await adminDb.jobPosting.update({
      where: { id: existing.id },
      data: {
        summary: "We're looking for an experienced backend engineer to join our growing team and help build scalable systems.",
        description: "As a Senior Backend Engineer, you will design and implement robust, scalable backend services. You'll work closely with product teams to deliver high-quality features and mentor junior engineers.",
        requirements: [
          "5+ years of experience with Node.js and TypeScript",
          "Strong understanding of microservices architecture",
          "Experience with PostgreSQL, Redis, and message queues",
          "Excellent problem-solving and communication skills",
          "Experience with AWS or similar cloud platforms",
        ],
        salaryMinInr: 2000000,
        salaryMaxInr: 3500000,
        tags: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "AWS", "Microservices"],
        status: "published",
        isRemote: true,
        internalOnly: false,
      },
    });

    console.log("✅ Updated test job posting:");
    console.log("   ID:", updated.id);
    console.log("   Title:", updated.title);
    console.log("   Status:", updated.status);
    console.log("   Salary: ₹" + updated.salaryMinInr?.toLocaleString("en-IN") + " - ₹" + updated.salaryMaxInr?.toLocaleString("en-IN"));
    console.log("   Location:", updated.location, "(Remote:", updated.isRemote + ")");
    console.log("   Department:", updated.department);
    console.log("   Requirements:", updated.requirements.length);
    console.log("   Tags:", updated.tags.join(", "));
  } else {
    const job = await adminDb.jobPosting.create({
      data: {
        title: "Senior Backend Engineer - Test",
        summary: "We're looking for an experienced backend engineer to join our growing team and help build scalable systems.",
        description: "As a Senior Backend Engineer, you will design and implement robust, scalable backend services. You'll work closely with product teams to deliver high-quality features and mentor junior engineers.",
        department: "Engineering",
        employmentType: "full_time",
        location: "Bangalore",
        isRemote: true,
        internalOnly: false,
        jobCode: "BE-001",
        status: "published",
        trackType: "standard",
        requirements: [
          "5+ years of experience with Node.js and TypeScript",
          "Strong understanding of microservices architecture",
          "Experience with PostgreSQL, Redis, and message queues",
          "Excellent problem-solving and communication skills",
          "Experience with AWS or similar cloud platforms",
        ],
        tags: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "AWS", "Microservices"],
        salaryMinInr: 2000000,
        salaryMaxInr: 3500000,
      },
    });

    console.log("✅ Created test job posting:");
    console.log("   ID:", job.id);
    console.log("   Title:", job.title);
    console.log("   Status:", job.status);
    console.log("   Salary: ₹" + job.salaryMinInr?.toLocaleString("en-IN") + " - ₹" + job.salaryMaxInr?.toLocaleString("en-IN"));
    console.log("   Location:", job.location, "(Remote:", job.isRemote + ")");
    console.log("   Department:", job.department);
    console.log("   Requirements:", job.requirements.length);
    console.log("   Tags:", job.tags.join(", "));
  }

  console.log("\n✅ Test job posting ready!");
  console.log("\n📋 Next step: Run sync to OrangeHRM");
  console.log("   npx tsx scripts/sync-to-orangehrm.ts\n");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
