CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, gender)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.raw_user_meta_data->>'gender'
  );
  
  -- Auto-follow admin user on signup
  IF NEW.id != '0750ccb0-54e3-4e41-a4fd-2d466f71f40b' THEN
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (NEW.id, '0750ccb0-54e3-4e41-a4fd-2d466f71f40b')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$