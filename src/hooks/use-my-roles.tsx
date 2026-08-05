import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyRoles, type MyRolesPayload } from "@/lib/roles.functions";
import type { AppRole } from "@prisma/client";

export type MyRoles = {
  isAdmin: boolean;
  isHr: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isStaff: boolean;
  isDashboardUser: boolean;
  roles: AppRole[];
  departmentId: string | null;
  checked: boolean;
  loading: boolean;
};

export function useMyRoles(): MyRoles {
  const { user, loading } = useAuth();
  const [payload, setPayload] = useState<MyRolesPayload | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setPayload(null);
      setChecked(true);
      return;
    }
    let cancelled = false;

    async function run() {
      try {
        const serverPayload = await getMyRoles();
        if (cancelled) return;
        setPayload(serverPayload);
        setChecked(true);
      } catch {
        if (cancelled) return;
        setPayload(null);
        setChecked(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return {
    isAdmin: payload?.isAdmin ?? false,
    isHr: payload?.isHr ?? false,
    isManager: payload?.isManager ?? false,
    isEmployee: payload?.isEmployee ?? false,
    isStaff: payload?.isStaff ?? false,
    isDashboardUser: payload?.isDashboardUser ?? false,
    roles: payload?.roles ?? [],
    departmentId: payload?.departmentId ?? null,
    checked,
    loading,
  };
}
