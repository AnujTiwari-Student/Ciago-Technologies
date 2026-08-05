import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient();
const ADMIN_EMAIL = "anujavengers@gmail.com";

(async () => {
  try {
    // Get admin user ID
    const adminResult = await pool.query(
      "SELECT auth_user_id FROM clerk_user_map WHERE email = $1",
      [ADMIN_EMAIL],
    );
    const adminUserId = adminResult.rows[0]?.auth_user_id;
    console.log("Admin User ID:", adminUserId);

    // Get orphaned role IDs
    const orphanedResult = await pool.query(`
      SELECT ur.id
      FROM user_roles ur
      LEFT JOIN clerk_user_map cum ON ur.user_id = cum.auth_user_id
      WHERE cum.auth_user_id IS NULL
    `);

    console.log(`Found ${orphanedResult.rowCount} orphaned roles`);

    // Try using Prisma to delete
    const deleteResult = await prisma.userRole.deleteMany({
      where: {
        user_id: {
          not: adminUserId,
        },
      },
    });

    console.log(`✓ Prisma deleted ${deleteResult.count} user_roles`);

    // Verify
    const remaining = await prisma.userRole.count();
    console.log(`✓ Remaining user_roles: ${remaining}`);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
})();
