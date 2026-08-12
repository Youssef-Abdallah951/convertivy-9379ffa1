-- 1) Preserve existing admin(s) as real rows in user_roles before removing the email bypass
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
WHERE lower(coalesce(p.email, '')) = 'yb109324@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) has_role: rely solely on user_roles (no hardcoded email escalation)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 3) ensure_user_account: remove hardcoded admin email branch
CREATE OR REPLACE FUNCTION public.ensure_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _name text := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'display_name',
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() -> 'user_metadata' ->> 'name',
    nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''),
    'User'
  );
  _is_admin boolean;
  _credits integer;
  _unlimited_until timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (_uid, nullif(_email, ''), _name)
  ON CONFLICT (user_id) DO UPDATE
    SET email = coalesce(EXCLUDED.email, public.profiles.email),
        display_name = coalesce(public.profiles.display_name, EXCLUDED.display_name),
        updated_at = now();

  INSERT INTO public.user_credits (user_id, credits)
  VALUES (_uid, 20)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT public.has_role(_uid, 'admin'::public.app_role) INTO _is_admin;
  SELECT credits, unlimited_until INTO _credits, _unlimited_until
  FROM public.user_credits
  WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'is_admin', coalesce(_is_admin, false),
    'credits', coalesce(_credits, 0),
    'unlimited_until', _unlimited_until
  );
END;
$function$;

-- 4) handle_new_user: remove hardcoded admin email branch
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = coalesce(EXCLUDED.email, public.profiles.email),
        display_name = coalesce(public.profiles.display_name, EXCLUDED.display_name),
        updated_at = now();

  INSERT INTO public.user_credits (user_id, credits)
  VALUES (NEW.id, 20)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 5) Tighten EXECUTE privileges on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_user_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_credits(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_payment_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_payment_request(uuid, text) FROM PUBLIC, anon;

-- trigger-only functions must never be callable from the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_payment_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated;

-- 6) shared-files bucket: authenticated-only uploads
DROP POLICY IF EXISTS "Anyone can upload to shared-files" ON storage.objects;
CREATE POLICY "Authenticated users can upload to shared-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shared-files');