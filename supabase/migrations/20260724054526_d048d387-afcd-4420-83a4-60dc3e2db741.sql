
-- Remove employee role from atpay2901 so they can test candidate + onboarding flow end-to-end
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'atpay2901@gmail.com')
  AND role = 'employee';

-- Stop the seed trigger from re-granting employee to this address on future confirmations
CREATE OR REPLACE FUNCTION public.grant_employee_for_seeded_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally disabled: no emails auto-granted employee anymore.
  RETURN NEW;
END;
$function$;

-- Clear any existing applications for this user so the 90-day cooldown doesn't block testing
DELETE FROM public.job_applications
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'atpay2901@gmail.com');
