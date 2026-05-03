
-- Add moderation columns to confessions
ALTER TABLE public.confessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- Drop old policies
DROP POLICY IF EXISTS "All authenticated can view confessions" ON public.confessions;

-- Users can only see approved confessions OR their own
CREATE POLICY "Users see approved or own confessions"
  ON public.confessions FOR SELECT TO authenticated
  USING (
    status = 'approved'
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Allow admins to update confessions (approve/reject)
CREATE POLICY "Admins can update confessions"
  ON public.confessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate the safe view with status filter
DROP VIEW IF EXISTS public.confessions_safe;
CREATE OR REPLACE VIEW public.confessions_safe
WITH (security_invoker = true) AS
SELECT
  id,
  CASE WHEN is_anonymous AND user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin')
    THEN NULL ELSE user_id END AS user_id,
  text, tag, is_anonymous, created_at, status, reviewed_at, reviewed_by
FROM public.confessions;

-- Approve all existing confessions so they remain visible
UPDATE public.confessions SET status = 'approved' WHERE status = 'pending';
