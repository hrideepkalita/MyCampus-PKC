
-- Restrict follows table visibility
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;

CREATE POLICY "Users can view own follows or admins"
ON public.follows
FOR SELECT
TO authenticated
USING (
  auth.uid() = follower_id
  OR auth.uid() = following_id
  OR public.has_role(auth.uid(), 'admin')
);

-- Counts function (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_follow_counts(_user_id uuid)
RETURNS TABLE(followers_count bigint, following_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.follows WHERE following_id = _user_id),
    (SELECT count(*) FROM public.follows WHERE follower_id = _user_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO authenticated, anon;

-- Mutual followers function
CREATE OR REPLACE FUNCTION public.get_mutual_followers(_viewer uuid, _target uuid)
RETURNS TABLE(names text[], remaining int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mutual_ids uuid[];
  _names text[];
  _total int;
BEGIN
  SELECT array_agg(f.follower_id) INTO _mutual_ids
  FROM public.follows f
  WHERE f.following_id = _target
    AND f.follower_id <> _viewer
    AND f.follower_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = _viewer
    );

  _total := COALESCE(array_length(_mutual_ids, 1), 0);

  SELECT array_agg(p.name) INTO _names
  FROM (
    SELECT name FROM public.profiles
    WHERE id = ANY(_mutual_ids)
    LIMIT 2
  ) p;

  RETURN QUERY SELECT COALESCE(_names, ARRAY[]::text[]), GREATEST(_total - COALESCE(array_length(_names,1),0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mutual_followers(uuid, uuid) TO authenticated;

-- Realtime for photo_likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_likes;
