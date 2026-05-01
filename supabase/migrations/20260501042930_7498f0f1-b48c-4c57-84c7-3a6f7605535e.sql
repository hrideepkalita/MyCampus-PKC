
-- =========================================================
-- 1. USER ROLES SYSTEM (proper admin role check)
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed admin user
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'rangiavlog@gmail.com'
ON CONFLICT DO NOTHING;

-- =========================================================
-- 2. FIX verification_requests RLS
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view all verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Authenticated can update verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Users can view own verification requests" ON public.verification_requests;

CREATE POLICY "Owners and admins can view verification requests"
ON public.verification_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update verification requests"
ON public.verification_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. FIX profiles admin policy (public role, no WITH CHECK)
-- =========================================================
DROP POLICY IF EXISTS "admin can verify users" ON public.profiles;
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;

CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- "Users can update own profile" policy already exists and is correct.
-- Add a trigger to prevent regular users from changing is_verified
CREATE OR REPLACE FUNCTION public.prevent_self_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.verified IS DISTINCT FROM OLD.verified
       OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only admins can change verification status or role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_verification_trigger ON public.profiles;
CREATE TRIGGER prevent_self_verification_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification();

-- =========================================================
-- 4. FIX notifications: lock down inserts, route through RPC
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SECURITY DEFINER function for cross-user notifications (likes, comments, friend requests)
CREATE OR REPLACE FUNCTION public.create_notification(
  _target_user_id UUID,
  _type TEXT,
  _title TEXT,
  _message TEXT,
  _related_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _allowed_types TEXT[] := ARRAY['like','comment','comment_reply','friend_request','friend_accept','follow','match','profile_view','verification','general'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (_type = ANY(_allowed_types)) THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;

  -- Prevent self-notifications
  IF _target_user_id = auth.uid() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (_target_user_id, _type, LEFT(_title, 200), LEFT(_message, 500), _related_id)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- =========================================================
-- 5. CONFESSIONS anonymity: hide user_id when anonymous
-- =========================================================
-- Tighten base table SELECT to own rows + admin only
DROP POLICY IF EXISTS "Anyone authenticated can view confessions" ON public.confessions;

CREATE POLICY "Owners and admins can view raw confessions"
ON public.confessions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Public-safe view that nulls out user_id for anonymous posts
CREATE OR REPLACE VIEW public.confessions_public
WITH (security_invoker = true)
AS
SELECT
  id,
  created_at,
  tag,
  text,
  is_anonymous,
  CASE WHEN is_anonymous THEN NULL ELSE user_id END AS user_id
FROM public.confessions;

GRANT SELECT ON public.confessions_public TO authenticated;

-- Allow authenticated users to read the safe view by relaxing base SELECT for non-sensitive columns via a second policy
-- Since security_invoker=true means RLS still applies, we need a policy that lets everyone see rows but the view masks user_id
DROP POLICY IF EXISTS "Owners and admins can view raw confessions" ON public.confessions;

CREATE POLICY "Authenticated can view confessions rows"
ON public.confessions FOR SELECT TO authenticated
USING (true);

-- Note: client code should query confessions_public instead of confessions to avoid de-anonymization.
-- The view masks user_id for anonymous posts at the column level.
