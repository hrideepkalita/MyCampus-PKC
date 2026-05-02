
-- 1. Create private bucket for verification IDs
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-ids', 'verification-ids', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for verification-ids bucket
CREATE POLICY "Users can upload own verification IDs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'verification-ids' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view verification IDs"
ON storage.objects FOR SELECT
USING (bucket_id = 'verification-ids' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix confession_reports: drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated can view all reports" ON public.confession_reports;

-- Add admin-only view policy
CREATE POLICY "Admins can view all reports"
ON public.confession_reports FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix confessions de-anonymization: replace the open SELECT policy
DROP POLICY IF EXISTS "Authenticated can view confessions rows" ON public.confessions;

CREATE POLICY "Authenticated can view confessions safely"
ON public.confessions FOR SELECT
TO authenticated
USING (
  NOT is_anonymous
  OR auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Also create a view that hides user_id for anonymous confessions
CREATE OR REPLACE VIEW public.confessions_safe AS
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
