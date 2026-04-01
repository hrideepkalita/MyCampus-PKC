
-- Create profile_views table
CREATE TABLE public.profile_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id UUID NOT NULL,
  viewed_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile views" ON public.profile_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can view own received views" ON public.profile_views
  FOR SELECT TO authenticated USING (auth.uid() = viewed_user_id OR auth.uid() = viewer_id);

-- Create profile_photos table
CREATE TABLE public.profile_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profile photos" ON public.profile_photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own photos" ON public.profile_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos" ON public.profile_photos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own photos" ON public.profile_photos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create photo_likes table
CREATE TABLE public.photo_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  photo_id UUID NOT NULL REFERENCES public.profile_photos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, photo_id)
);

ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photo likes" ON public.photo_likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own photo likes" ON public.photo_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photo likes" ON public.photo_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add unique constraints if not exists
ALTER TABLE public.likes ADD CONSTRAINT likes_unique_pair UNIQUE (from_user_id, to_user_id);

ALTER TABLE public.follows ADD CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON public.profile_views(viewed_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_viewed ON public.profile_views(viewer_id, viewed_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_photos_user ON public.profile_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_likes_photo ON public.photo_likes(photo_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_from_to ON public.likes(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT DO NOTHING;

-- Storage RLS for profile-photos bucket
CREATE POLICY "Anyone can view profile photos storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');

CREATE POLICY "Auth users can upload profile photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "Users can delete own profile photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
