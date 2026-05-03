-- Fix: Allow all authenticated users to SELECT all confessions
-- The safe view handles identity masking, so the base table just needs to be readable
DROP POLICY IF EXISTS "Authenticated can view confessions safely" ON public.confessions;

CREATE POLICY "All authenticated can view confessions"
  ON public.confessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Drop redundant view
DROP VIEW IF EXISTS public.confessions_public;

-- Recreate confessions_safe with security_invoker
DROP VIEW IF EXISTS public.confessions_safe;
CREATE OR REPLACE VIEW public.confessions_safe
WITH (security_invoker = true) AS
SELECT
  id,
  CASE
    WHEN is_anonymous
         AND user_id != auth.uid()
         AND NOT public.has_role(auth.uid(), 'admin'::app_role)
      THEN NULL
    ELSE user_id
  END AS user_id,
  text,
  tag,
  is_anonymous,
  created_at
FROM public.confessions;