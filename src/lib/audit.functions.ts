import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

export type AuditLog = {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_resource: string | null;
  details: any;
};

const filterSchema = z
  .object({
    action: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().min(1).max(500).optional(),
  })
  .optional();

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const count = await context.db.withRLS((tx) =>
      tx.userRole.count({ where: { userId: context.userId, role: { in: ["admin", "hr"] } } }),
    );
    if (count === 0) throw new Error("Forbidden");

    const adminDb = getAdminDb();
    const rows = await adminDb.auditLog.findMany({
      where: {
        ...(data?.action && { action: data.action }),
        ...(data?.from && { timestamp: { gte: new Date(data.from) } }),
        ...(data?.to && { timestamp: { lte: new Date(data.to) } }),
      },
      orderBy: { timestamp: "desc" },
      take: data?.limit ?? 200,
    });
    return rows as unknown as AuditLog[];
  });
