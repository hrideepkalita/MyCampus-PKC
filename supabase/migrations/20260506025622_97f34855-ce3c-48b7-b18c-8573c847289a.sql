CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  _project_url TEXT := 'https://rlhbezsavhswdwihnhpi.supabase.co';
  _service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO _service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  PERFORM net.http_post(
    url := _project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'related_id', NEW.related_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'dispatch_push_notification error: %', SQLERRM;
  RETURN NEW;
END;
$function$;