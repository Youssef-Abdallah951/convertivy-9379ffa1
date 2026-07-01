-- Restore Data API access for existing public tables used by auth/admin/credits.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, UPDATE ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

-- Protect profile data while still allowing the owner and admins to load what they need.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Make the configured owner email an admin even when a role row has not been created yet.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
    OR (
      _role = 'admin'::public.app_role
      AND _user_id = auth.uid()
      AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'yb109324@gmail.com'
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Repair/bootstrap the signed-in user's app account without overwriting existing credits or roles.
CREATE OR REPLACE FUNCTION public.ensure_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF _email = 'yb109324@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

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
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_account() TO authenticated;

-- Keep new-user setup aligned with the admin email rule and preserve existing rows on retry.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF lower(NEW.email) = 'yb109324@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Make credit spending self-heal missing credit rows while preserving existing balances.
CREATE OR REPLACE FUNCTION public.spend_credits(_amount integer, _tool_slug text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits%rowtype;
  _new_balance integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  PERFORM public.ensure_user_account();

  SELECT * INTO _row FROM public.user_credits WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDITS_ACCOUNT';
  END IF;

  IF _row.unlimited_until IS NOT NULL AND _row.unlimited_until > now() THEN
    RETURN _row.credits;
  END IF;

  IF _row.credits < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  _new_balance := _row.credits - _amount;
  UPDATE public.user_credits
    SET credits = _new_balance, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.credit_transactions (user_id, amount, tool_slug, reason, balance_after)
  VALUES (_uid, -_amount, _tool_slug, 'tool_usage', _new_balance);

  RETURN _new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text) TO authenticated;

-- Repair notification trigger/function idempotently.
CREATE OR REPLACE FUNCTION public.notify_admin_on_payment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (payment_request_id, user_id, status)
  VALUES (NEW.id, NEW.user_id, 'pending')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_payment_request ON public.payment_requests;
CREATE TRIGGER trg_notify_admin_on_payment_request
  AFTER INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_payment_request();

CREATE OR REPLACE FUNCTION public.approve_payment_request(_request_id uuid, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.payment_requests%rowtype;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO r FROM public.payment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;

  IF r.package = 'unlimited' THEN
    INSERT INTO public.user_credits (user_id, credits, unlimited_until)
    VALUES (r.user_id, 0, now() + interval '30 days')
    ON CONFLICT (user_id) DO UPDATE
      SET unlimited_until = greatest(coalesce(public.user_credits.unlimited_until, now()), now()) + interval '30 days',
          updated_at = now();
  ELSE
    INSERT INTO public.user_credits (user_id, credits)
    VALUES (r.user_id, r.credits_amount)
    ON CONFLICT (user_id) DO UPDATE
      SET credits = public.user_credits.credits + r.credits_amount,
          updated_at = now();
  END IF;

  UPDATE public.payment_requests
  SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), admin_notes = _notes
  WHERE id = _request_id;

  UPDATE public.admin_notifications
  SET status = 'processed', is_read = true, updated_at = now()
  WHERE payment_request_id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_payment_request(_request_id uuid, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.payment_requests
  SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), admin_notes = _notes
  WHERE id = _request_id AND status = 'pending';

  UPDATE public.admin_notifications
  SET status = 'processed', is_read = true, updated_at = now()
  WHERE payment_request_id = _request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated;

-- Backfill notifications for existing pending payment requests that predate the trigger repair.
INSERT INTO public.admin_notifications (payment_request_id, user_id, status)
SELECT pr.id, pr.user_id, 'pending'
FROM public.payment_requests pr
WHERE pr.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_notifications an WHERE an.payment_request_id = pr.id
  );