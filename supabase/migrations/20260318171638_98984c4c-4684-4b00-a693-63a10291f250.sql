
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  branch TEXT,
  bio TEXT DEFAULT '',
  photo_url TEXT,
  interests TEXT[] DEFAULT '{}',
  looking_for TEXT DEFAULT 'Not sure 🤷',
  verified TEXT DEFAULT 'unverified',
  instagram TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'New User'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Likes table (track swipes)
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_like BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own likes" ON public.likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can view own likes" ON public.likes
  FOR SELECT TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches" ON public.matches
  FOR SELECT TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Function to check for mutual like and create match
CREATE OR REPLACE FUNCTION public.check_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_like = true AND EXISTS (
    SELECT 1 FROM public.likes
    WHERE from_user_id = NEW.to_user_id
      AND to_user_id = NEW.from_user_id
      AND is_like = true
  ) THEN
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (LEAST(NEW.from_user_id, NEW.to_user_id), GREATEST(NEW.from_user_id, NEW.to_user_id))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_check_match
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.check_match();

-- Confessions table
CREATE TABLE public.confessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'secret',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view confessions" ON public.confessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own confessions" ON public.confessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Confession likes
CREATE TABLE public.confession_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(confession_id, user_id)
);

ALTER TABLE public.confession_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view confession likes" ON public.confession_likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own confession likes" ON public.confession_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own confession likes" ON public.confession_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
