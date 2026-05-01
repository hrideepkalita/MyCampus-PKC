
DROP VIEW IF EXISTS public.confessions_public;

CREATE VIEW public.confessions_public
WITH (security_invoker = true)
AS
SELECT
  id,
  CASE WHEN is_anonymous THEN NULL ELSE user_id END AS user_id,
  is_anonymous,
  created_at,
  tag,
  text
FROM public.confessions;

GRANT SELECT ON public.confessions_public TO authenticated;
