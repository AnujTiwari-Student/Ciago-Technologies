import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uploadSchema = z.object({
  bucket: z.enum(["resumes", "avatars", "onboarding-docs", "identity-docs"]),
  path: z.string().min(1).max(500),
  base64: z.string().min(1),
  contentType: z.string().optional(),
  upsert: z.boolean().optional(),
});

export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => uploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(context.userId + "/")) {
      throw new Error("Forbidden: upload path must be scoped to your user ID");
    }

    const { getStorage } = await import("@/lib/storage");
    const storage = getStorage();
    const buffer = Buffer.from(data.base64, "base64");
    const result = await storage.upload(data.bucket, data.path, buffer, data.contentType);
    if (result.error) throw new Error(result.error);
    return { path: data.path };
  });
