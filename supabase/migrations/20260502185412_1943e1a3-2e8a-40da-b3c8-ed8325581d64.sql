
DROP VIEW IF EXISTS public.confessions_safe;

CREATE OR REPLACE VIEW public.confessions_safe
WITH (security_invoker = true) AS
SELECT
  id,
  CASE WHEN is_anonymous AND user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role)
    THEN NULL
    ELSE user_id
  END AS user_id,
  text,
  tag,
  is_anonymous,
  created_at
FROM public.confessions;
