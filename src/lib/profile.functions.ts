import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function signAvatar(supabase: any, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileRow> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, full_name, public_email, bio, pronouns, website, linkedin, portfolio, leetcode, avatar_path",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const base: ProfileRow = {
      user_id: userId,
      full_name: null,
      public_email: null,
      bio: null,
      pronouns: null,
      website: null,
      linkedin: null,
      portfolio: null,
      leetcode: null,
      avatar_path: null,
      avatar_url: null,
      ...(data ?? {}),
    };
    base.avatar_url = await signAvatar(supabase, base.avatar_path);
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
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, any> = { user_id: userId };
    for (const [k, v] of Object.entries(data)) {
      payload[k] = v === "" ? null : (v ?? null);
    }
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    if (payload.full_name) {
      await supabase.auth.updateUser({ data: { full_name: payload.full_name } });
    }
    return { ok: true };
  });

export const withdrawMyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS enforces status='applied' AND user ownership
    const { data: row, error: fetchErr } = await supabase
      .from("job_applications")
      .select("id, resume_storage_path, status, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row || row.user_id !== userId) throw new Error("Application not found");
    if (row.status !== "applied")
      throw new Error("Only applications in the Applied stage can be withdrawn");

    const { error } = await supabase.from("job_applications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row.resume_storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("resumes").remove([row.resume_storage_path]);
    }
    return { ok: true };
  });
