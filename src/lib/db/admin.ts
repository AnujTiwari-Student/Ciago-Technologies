import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

if (typeof WebSocket === "undefined") {
  try {
    // Node.js: use ws package
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {}
}

let _adminDb: PrismaClient | undefined;

export function getAdminDb(): PrismaClient {
  if (!_adminDb) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("Missing environment variable: DATABASE_URL");

    const adapter = new PrismaNeon({ connectionString: url });
    _adminDb = new PrismaClient({
      adapter,
      log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return _adminDb;
}

export function resetAdminDb(): void {
  _adminDb = undefined;
}
