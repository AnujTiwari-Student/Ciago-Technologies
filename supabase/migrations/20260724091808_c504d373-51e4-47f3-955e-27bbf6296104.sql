
-- Allow managers to approve/reject leave for employees in their department.
DROP POLICY IF EXISTS "Managers manage team leave" ON public.leave_requests;
CREATE POLICY "Managers manage team leave" ON public.leave_requests
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_roles mgr
    JOIN public.user_roles emp ON emp.department_id = mgr.department_id
    WHERE mgr.user_id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.department_id IS NOT NULL
      AND emp.user_id = public.leave_requests.user_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_roles mgr
    JOIN public.user_roles emp ON emp.department_id = mgr.department_id
    WHERE mgr.user_id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.department_id IS NOT NULL
      AND emp.user_id = public.leave_requests.user_id
  )
);
