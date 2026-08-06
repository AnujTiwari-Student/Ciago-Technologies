/**
 * Export Additional Master Data (Employee Grades, Project Templates)
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

const exportDir = path.join(process.cwd(), "frappe-exports", "master_data");

async function frappe(endpoint: string) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.json();
}

async function exportData() {
  console.log("========================================");
  console.log(" Exporting Additional Master Data");
  console.log("========================================\n");

  // Export Employee Grades
  console.log("Exporting Employee Grades...");
  const grades = await frappe("/api/resource/Employee Grade?limit_page_length=100");
  fs.writeFileSync(
    path.join(exportDir, "employee_grades.json"),
    JSON.stringify(grades.data, null, 2)
  );
  console.log(`  Exported: ${grades.data?.length || 0} employee grades`);

  // Export Project Templates
  console.log("\nExporting Project Templates...");
  const projects = await frappe("/api/resource/Project?fields=[\"*\"]&filters=[[\"is_template\",\"=\",1]]&limit_page_length=100");

  // Get full details for each project template
  const fullProjects = [];
  for (const proj of projects.data || []) {
    const detail = await frappe(`/api/resource/Project/${encodeURIComponent(proj.name)}`);
    fullProjects.push(detail.data);
  }

  fs.writeFileSync(
    path.join(exportDir, "project_templates.json"),
    JSON.stringify(fullProjects, null, 2)
  );
  console.log(`  Exported: ${fullProjects.length} project templates`);

  // Export Job Opening Templates
  console.log("\nExporting Job Opening Templates...");
  const jobs = await frappe("/api/resource/Job Opening?fields=[\"*\"]&limit_page_length=100");
  fs.writeFileSync(
    path.join(exportDir, "job_openings.json"),
    JSON.stringify(jobs.data, null, 2)
  );
  console.log(`  Exported: ${jobs.data?.length || 0} job openings`);

  console.log("\n========================================");
  console.log(" Export Complete!");
  console.log("========================================\n");
  console.log(`Location: ${exportDir}`);
  console.log("\nFiles created:");
  console.log("  - employee_grades.json");
  console.log("  - project_templates.json");
  console.log("  - job_openings.json\n");
}

exportData().catch(console.error);
