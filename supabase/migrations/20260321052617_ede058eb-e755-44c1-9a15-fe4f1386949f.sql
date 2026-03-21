
-- Add is_anonymous to confessions (default true for backward compat)
ALTER TABLE public.confessions ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT true;

-- Create confession_reports table
CREATE TABLE public.confession_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  confession_id uuid NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  reason text DEFAULT 'inappropriate',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, confession_id)
);
ALTER TABLE public.confession_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reports"
ON public.confession_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own reports"
ON public.confession_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can view all reports"
ON public.confession_reports FOR SELECT TO authenticated
USING (true);

-- Create notices table
CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view notices"
ON public.notices FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert own notices"
ON public.notices FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notices"
ON public.notices FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT null;

-- Allow admin to delete confessions
CREATE POLICY "Users can delete own confessions"
ON public.confessions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create notices storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('notices', 'notices', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view notice images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notices');

CREATE POLICY "Authenticated users can upload notice images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notices');
