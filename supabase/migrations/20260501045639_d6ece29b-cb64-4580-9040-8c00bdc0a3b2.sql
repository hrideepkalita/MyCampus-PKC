DROP POLICY IF EXISTS "Users can insert own notices" ON public.notices;

CREATE POLICY "Union members or admins can post notices"
ON public.notices FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND is_verified = true
        AND role = 'union'
    )
  )
);