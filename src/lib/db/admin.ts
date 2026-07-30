import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let _adminDb: PrismaClient | undefined;

export function getAdminDb(): PrismaClient {
  if (!_adminDb) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("Missing environment variable: DATABASE_URL");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    _adminDb = new PrismaClient({
      adapter,
      log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return _adminDb;
}
