
-- Fix notification insert policy to be less permissive
DROP POLICY "Service can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage bucket for lost-found images
INSERT INTO storage.buckets (id, name, public) VALUES ('lost-found', 'lost-found', true);

-- Storage policies for lost-found bucket
CREATE POLICY "Anyone can view lost-found images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lost-found');

CREATE POLICY "Authenticated users can upload lost-found images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lost-found');

CREATE POLICY "Users can delete own lost-found images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lost-found' AND (storage.foldername(name))[1] = auth.uid()::text);
