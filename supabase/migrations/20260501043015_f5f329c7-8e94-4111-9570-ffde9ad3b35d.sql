
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
  _allowed_types TEXT[] := ARRAY[
    'like','post_like','photo_like','comment','comment_reply',
    'friend_request','friend_accepted','friend_accept',
    'follow','match','profile_view','verification','general'
  ];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (_type = ANY(_allowed_types)) THEN
    RAISE EXCEPTION 'Invalid notification type: %', _type;
  END IF;

  IF _target_user_id = auth.uid() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (_target_user_id, _type, LEFT(_title, 200), LEFT(_message, 500), _related_id)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
