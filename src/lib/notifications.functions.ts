import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InAppNotification = {
  id: string;
  application_id: string | null;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = await context.db.withRLS((tx) =>
      tx.inAppNotification.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    );
    return rows as unknown as InAppNotification[];
  });

const idSchema = z.object({ id: z.string().uuid() });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await context.db.withRLS((tx) =>
      tx.inAppNotification.updateMany({
        where: { id: data.id, userId: context.userId },
        data: { read: true },
      }),
    );
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.db.withRLS((tx) =>
      tx.inAppNotification.updateMany({
        where: { userId: context.userId, read: false },
        data: { read: true },
      }),
    );
    return { ok: true };
  });
