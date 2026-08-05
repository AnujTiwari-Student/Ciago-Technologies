import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

export type ProfileRow = {
  user_id: string;
  full_name: string | null;
  public_email: string | null;
  bio: string | null;
  pronouns: string | null;
  website: string | null;
  linkedin: string | null;
  portfolio: string | null;
  leetcode: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileRow> => {
    const data = await context.db.withRLS((tx) =>
      tx.profile.findUnique({ where: { userId: context.userId } }),
    );

    const base: ProfileRow = {
      user_id: context.userId,
      full_name: data?.fullName ?? null,
      public_email: data?.publicEmail ?? null,
      bio: data?.bio ?? null,
      pronouns: data?.pronouns ?? null,
      website: data?.website ?? null,
      linkedin: data?.linkedin ?? null,
      portfolio: data?.portfolio ?? null,
      leetcode: data?.leetcode ?? null,
      avatar_path: data?.avatarPath ?? null,
      avatar_url: null,
    };

    // Storage: signed URL for avatar (R2)
    if (base.avatar_path) {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      const result = await storage.createSignedUrl("avatars", base.avatar_path, 60 * 60 * 24 * 7);
      base.avatar_url = result.signedUrl;
    }

    return base;
  });

const urlField = z.string().trim().max(300).url().or(z.literal("")).optional();
const profileSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  public_email: z.string().trim().email().max(200).or(z.literal("")).optional(),
  bio: z.string().trim().max(600).optional(),
  pronouns: z.string().trim().max(40).optional(),
  website: urlField,
  linkedin: urlField,
  portfolio: urlField,
  leetcode: urlField,
  avatar_path: z.string().trim().max(300).or(z.literal("")).optional(),
});

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const prismaData: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      full_name: "fullName",
      public_email: "publicEmail",
      bio: "bio",
      pronouns: "pronouns",
      website: "website",
      linkedin: "linkedin",
      portfolio: "portfolio",
      leetcode: "leetcode",
      avatar_path: "avatarPath",
    };
    for (const [snake, camel] of Object.entries(fieldMap)) {
      const v = (data as any)[snake];
      if (v !== undefined) prismaData[camel] = v === "" ? null : v;
    }

    await context.db.withRLS((tx) =>
      tx.profile.upsert({
        where: { userId: context.userId },
        create: { userId: context.userId, ...prismaData },
        update: prismaData,
      }),
    );

    return { ok: true };
  });

export const withdrawMyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const row = await context.db.withRLS((tx) =>
      tx.jobApplication.findFirst({
        where: { id: data.id, userId: context.userId },
        select: { id: true, resumeStoragePath: true, status: true },
      }),
    );
    if (!row) throw new Error("Application not found");
    if (row.status !== "applied")
      throw new Error("Only applications in the Applied stage can be withdrawn");

    await context.db.withRLS((tx) => tx.jobApplication.delete({ where: { id: data.id } }));

    if (row.resumeStoragePath) {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      await storage.remove("resumes", [row.resumeStoragePath]);
    }
    return { ok: true };
  });
