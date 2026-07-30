import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyRoles, type MyRolesPayload } from "@/lib/roles.functions";

export type MyRoles = {
  isAdmin: boolean;
  isHr: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isStaff: boolean;
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
    return () => { cancelled = true; };
  }, [user, loading]);

  const isAdmin = payload?.isAdmin ?? false;
  const isHr = payload?.isHr ?? false;
  const isManager = payload?.isManager ?? false;
  const isEmployee = payload?.isEmployee ?? false;
  return {
    isAdmin,
    isHr,
    isManager,
    isEmployee,
    isStaff: isAdmin || isHr || isManager || isEmployee,
    departmentId: payload?.departmentId ?? null,
    checked,
    loading,
  };
}
