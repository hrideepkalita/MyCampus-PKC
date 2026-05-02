
-- 1. Create profile_contacts table for private phone storage
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

-- Owner-only read
CREATE POLICY "Users can view own contacts"
  ON public.profile_contacts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Matched users can also view
CREATE POLICY "Matched users can view contacts"
  ON public.profile_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE (user1_id = auth.uid() AND user2_id = profile_contacts.user_id)
         OR (user2_id = auth.uid() AND user1_id = profile_contacts.user_id)
    )
  );

CREATE POLICY "Users can insert own contacts"
  ON public.profile_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON public.profile_contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Migrate existing phone data
INSERT INTO public.profile_contacts (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL AND phone != ''
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone;

-- Drop phone from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- 2. Re-ensure the self-verification trigger exists
DROP TRIGGER IF EXISTS prevent_self_verification_trigger ON public.profiles;
CREATE TRIGGER prevent_self_verification_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification();

-- 3. Owner SELECT on verification-ids bucket
CREATE POLICY "Owners can view own verification IDs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification-ids' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Fix confession_likes SELECT to protect anonymous authors
DROP POLICY IF EXISTS "Users can view confession likes" ON public.confession_likes;
CREATE POLICY "Users can view confession likes safely"
  ON public.confession_likes FOR SELECT
  TO authenticated
  USING (
    -- Allow if the confession is not anonymous
    EXISTS (
      SELECT 1 FROM public.confessions c
      WHERE c.id = confession_likes.confession_id AND NOT c.is_anonymous
    )
    -- Or the viewer is the confession author
    OR EXISTS (
      SELECT 1 FROM public.confessions c
      WHERE c.id = confession_likes.confession_id AND c.user_id = auth.uid()
    )
    -- Or the viewer is the liker themselves
    OR auth.uid() = user_id
    -- Or admin
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. Fix confession_replies SELECT similarly
DROP POLICY IF EXISTS "Anyone authenticated can view replies" ON public.confession_replies;
CREATE POLICY "Users can view confession replies safely"
  ON public.confession_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.confessions c
      WHERE c.id = confession_replies.confession_id AND NOT c.is_anonymous
    )
    OR EXISTS (
      SELECT 1 FROM public.confessions c
      WHERE c.id = confession_replies.confession_id AND c.user_id = auth.uid()
    )
    OR auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
  );
