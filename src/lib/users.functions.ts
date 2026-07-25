import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEPT_TYPES = [
  "engineering",
  "operations",
  "human_resource",
  "management",
  "product",
  "design",
  "finance",
  "sales",
  "marketing",
  "customer_support",
  "legal",
  "it_infrastructure",
] as const;
export type DeptType = (typeof DEPT_TYPES)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contractor", "intern", "probation"] as const;
export const WORK_MODELS = ["onsite", "remote", "hybrid"] as const;
export const PROBATION_STATUSES = ["under_review", "confirmed", "extended"] as const;
export const BG_CHECK_STATUSES = ["not_started", "in_progress", "cleared", "flagged"] as const;
export const DOC_VERIFY_STATUSES = ["pending", "verified", "rejected"] as const;
export const ID_DOC_TYPES = ["pan", "aadhaar", "passport"] as const;

export type AppRole = "admin" | "hr" | "manager" | "employee" | "user";

export type DirectoryRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_admin: boolean;
  department: DeptType | null;
  designation: string | null;
  team_name: string | null;
  doj: string | null;
  employment_type: string | null;
  work_model: string | null;
  work_location: string | null;
  base_salary: number | null;
  salary_currency: string;
  probation_status: string;
  background_check_status: string;
  doc_verification_status: string;
  reporting_manager_id: string | null;
  reporting_hr_id: string | null;
  created_at: string;
};

async function getActorRoles(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set<AppRole>((data ?? []).map((r: any) => r.role));
  return {
    isAdmin: roles.has("admin"),
    isHr: roles.has("hr"),
  };
}

export const listDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DirectoryRow[]> => {
    const { data, error } = await context.supabase.rpc("list_directory");
    if (error) throw new Error(error.message);
    return (data ?? []) as DirectoryRow[];
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const actor = await getActorRoles(supabase, userId);
    if (!actor.isAdmin && !actor.isHr) throw new Error("Forbidden");

    const { data: targetIsAdmin } = await supabase.rpc("is_admin_user", { _uid: data.user_id });
    if (actor.isHr && !actor.isAdmin && targetIsAdmin) {
      throw new Error("HR users cannot modify System Admin accounts");
    }

    const [{ data: emp }, { data: profile }, { data: roles }, { data: docs }] = await Promise.all([
      supabase.from("employees").select("*").eq("user_id", data.user_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("user_id, full_name, public_email")
        .eq("user_id", data.user_id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user_id),
      supabase
        .from("identity_documents")
        .select("*")
        .eq("user_id", data.user_id)
        .order("doc_type"),
    ]);

    // sign docs
    const signedDocs = await Promise.all(
      (docs ?? []).map(async (d: any) => {
        let signed_url: string | null = null;
        if (d.storage_path) {
          const { data: s } = await supabase.storage
            .from("identity-docs")
            .createSignedUrl(d.storage_path, 60 * 60);
          signed_url = s?.signedUrl ?? null;
        }
        return { ...d, signed_url };
      }),
    );

    return {
      employee: emp,
      profile,
      roles: (roles ?? []).map((r: any) => r.role as AppRole),
      is_admin_target: !!targetIsAdmin,
      documents: signedDocs,
    };
  });

const employeeSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().max(120).optional().nullable(),
  work_email: z.string().trim().email().max(200).or(z.literal("")).optional().nullable(),
  personal_email: z.string().trim().email().max(200).or(z.literal("")).optional().nullable(),
  contact_number: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  department: z.enum(DEPT_TYPES).optional().nullable(),
  team_name: z.string().trim().max(120).optional().nullable(),
  designation: z.string().trim().max(160).optional().nullable(),
  reporting_manager_id: z.string().uuid().optional().nullable(),
  reporting_hr_id: z.string().uuid().optional().nullable(),
  doj: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().nullable(),
  base_salary: z.number().nonnegative().max(999999999).optional().nullable(),
  salary_currency: z.string().trim().min(1).max(6).default("INR").optional(),
  work_model: z.enum(WORK_MODELS).optional().nullable(),
  work_location: z.string().trim().max(160).optional().nullable(),
  probation_months: z.number().int().min(0).max(24).optional().nullable(),
  probation_status: z.enum(PROBATION_STATUSES).optional(),
  background_check_status: z.enum(BG_CHECK_STATUSES).optional(),
  doc_verification_status: z.enum(DOC_VERIFY_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => employeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const actor = await getActorRoles(supabase, userId);
    if (!actor.isAdmin && !actor.isHr) throw new Error("Forbidden");

    const { data: targetIsAdmin } = await supabase.rpc("is_admin_user", { _uid: data.user_id });
    if (actor.isHr && !actor.isAdmin && targetIsAdmin) {
      throw new Error("HR users cannot modify System Admin accounts");
    }

    // profile write (full_name)
    if (data.full_name !== undefined) {
      await supabase
        .from("profiles")
        .upsert({ user_id: data.user_id, full_name: data.full_name || null }, { onConflict: "user_id" });
    }

    const emp: Record<string, any> = { user_id: data.user_id };
    const keys = [
      "work_email","personal_email","contact_number","address","department","team_name",
      "designation","reporting_manager_id","reporting_hr_id","doj","employment_type",
      "base_salary","salary_currency","work_model","work_location","probation_months",
      "probation_status","background_check_status","doc_verification_status","notes",
    ] as const;
    for (const k of keys) {
      const v = (data as any)[k];
      if (v !== undefined) emp[k] = v === "" ? null : v;
    }

    const { error } = await supabase.from("employees").upsert(emp, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "user.employee_upsert",
      target_resource: data.user_id,
      details: { fields: Object.keys(emp).filter((k) => k !== "user_id") },
    });

    return { ok: true };
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "hr", "manager", "employee"]),
  department_id: z.string().uuid().optional().nullable(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const actor = await getActorRoles(supabase, userId);
    if (!actor.isAdmin && !actor.isHr) throw new Error("Forbidden");

    const { data: targetIsAdmin } = await supabase.rpc("is_admin_user", { _uid: data.user_id });
    if (actor.isHr && !actor.isAdmin) {
      if (targetIsAdmin) throw new Error("HR users cannot modify System Admin accounts");
      if (data.role === "admin") throw new Error("Only Admins can grant the Admin role");
    }

    const { error } = await supabase.rpc("admin_set_user_role", {
      _target_user_id: data.user_id,
      _new_role: data.role,
      _department_id: data.department_id ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const idDocSchema = z.object({
  user_id: z.string().uuid(),
  doc_type: z.enum(ID_DOC_TYPES),
  doc_number: z.string().trim().max(60).optional().nullable(),
  storage_path: z.string().trim().max(300).optional().nullable(),
});

export const upsertIdentityDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id !== userId) {
      const actor = await getActorRoles(supabase, userId);
      if (!actor.isAdmin) throw new Error("Only the owner or admin can upload identity documents");
    }
    const payload = {
      user_id: data.user_id,
      doc_type: data.doc_type,
      doc_number: data.doc_number || null,
      storage_path: data.storage_path || null,
      status: "pending" as const,
      feedback: null,
      verified_by: null,
      verified_at: null,
    };
    const { error } = await supabase
      .from("identity_documents")
      .upsert(payload, { onConflict: "user_id,doc_type" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const verifyDocSchema = z.object({
  doc_id: z.string().uuid(),
  status: z.enum(["pending", "verified", "rejected"]),
  feedback: z.string().trim().max(500).optional().nullable(),
});

export const verifyIdentityDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifyDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const actor = await getActorRoles(supabase, userId);
    if (!actor.isAdmin && !actor.isHr) throw new Error("Forbidden");

    const { data: doc, error: fetchErr } = await supabase
      .from("identity_documents")
      .select("id, user_id")
      .eq("id", data.doc_id)
      .maybeSingle();
    if (fetchErr || !doc) throw new Error("Document not found");
    if (doc.user_id === userId) throw new Error("Cannot verify your own documents");

    const { data: targetIsAdmin } = await supabase.rpc("is_admin_user", { _uid: doc.user_id });
    if (actor.isHr && !actor.isAdmin && targetIsAdmin) {
      throw new Error("HR users cannot modify System Admin accounts");
    }

    const { error } = await supabase
      .from("identity_documents")
      .update({
        status: data.status,
        feedback: data.feedback || null,
        verified_by: userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.doc_id);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: `idoc.${data.status}`,
      target_resource: doc.user_id,
      details: { doc_id: data.doc_id },
    });
    return { ok: true };
  });

export const listAssignables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const actor = await getActorRoles(supabase, userId);
    if (!actor.isAdmin && !actor.isHr) throw new Error("Forbidden");
    const { data, error } = await supabase.rpc("list_directory");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as DirectoryRow[];
    return {
      managers: rows.filter((r) => r.role === "manager" || r.role === "admin"),
      hrs: rows.filter((r) => r.role === "hr" || r.role === "admin"),
    };
  });
