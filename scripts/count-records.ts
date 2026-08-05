import { prisma } from "../src/lib/prisma";

async function main() {
  const jobAppCount = await prisma.jobApplication.count();
  const employeeCount = await prisma.employee.count();
  const auditLogCount = await prisma.auditLog.count();

  console.log("job_applications:", jobAppCount);
  console.log("employees:", employeeCount);
  console.log("audit_logs:", auditLogCount);

  await prisma.$disconnect();
}

main().catch(console.error);
