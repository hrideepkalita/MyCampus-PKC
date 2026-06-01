DROP POLICY IF EXISTS "Union members or admins can post notices" ON public.notices;
DROP POLICY IF EXISTS "Users can delete own notices" ON public.notices;

CREATE POLICY "Admins can insert notices"
ON public.notices
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Admins can update notices"
ON public.notices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete notices"
ON public.notices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));