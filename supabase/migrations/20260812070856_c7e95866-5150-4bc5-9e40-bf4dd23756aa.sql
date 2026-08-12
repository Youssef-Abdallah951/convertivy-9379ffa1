-- 1. Official package catalog
CREATE TABLE IF NOT EXISTS public.credit_packages (
  package public.credit_package PRIMARY KEY,
  credits_amount integer NOT NULL CHECK (credits_amount >= 0),
  price_egp integer NOT NULL CHECK (price_egp > 0)
);

GRANT SELECT ON public.credit_packages TO anon, authenticated;
GRANT ALL ON public.credit_packages TO service_role;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view credit packages" ON public.credit_packages;
CREATE POLICY "Anyone can view credit packages"
ON public.credit_packages FOR SELECT
USING (true);

INSERT INTO public.credit_packages (package, credits_amount, price_egp) VALUES
  ('starter', 50, 99),
  ('basic', 150, 249),
  ('pro', 500, 499),
  ('unlimited', 0, 799)
ON CONFLICT (package) DO UPDATE
  SET credits_amount = EXCLUDED.credits_amount,
      price_egp = EXCLUDED.price_egp;

-- 2. Validate payment requests against the catalog
CREATE OR REPLACE FUNCTION public.validate_payment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.credit_packages%rowtype;
BEGIN
  SELECT * INTO p FROM public.credit_packages WHERE package = NEW.package;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PACKAGE';
  END IF;

  -- Always force the official values; never trust client-supplied amounts.
  NEW.credits_amount := p.credits_amount;
  NEW.price_egp := p.price_egp;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_payment_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_payment_request ON public.payment_requests;
CREATE TRIGGER trg_validate_payment_request
BEFORE INSERT OR UPDATE OF package, credits_amount, price_egp ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_request();

-- 3. Official per-tool credit costs
CREATE TABLE IF NOT EXISTS public.tool_credit_costs (
  tool_slug text PRIMARY KEY,
  cost integer NOT NULL CHECK (cost >= 0)
);

GRANT SELECT ON public.tool_credit_costs TO anon, authenticated;
GRANT ALL ON public.tool_credit_costs TO service_role;
ALTER TABLE public.tool_credit_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tool costs" ON public.tool_credit_costs;
CREATE POLICY "Anyone can view tool costs"
ON public.tool_credit_costs FOR SELECT
USING (true);

INSERT INTO public.tool_credit_costs (tool_slug, cost) VALUES
  ('json-formatter', 0),
  ('study-timer', 0),
  ('image-compressor', 2),
  ('file-to-qr', 2),
  ('link-to-qr', 2),
  ('file-to-link', 2),
  ('link-to-file', 2),
  ('code-generator', 2),
  ('unit-converter', 2),
  ('universal-encoder', 2),
  ('color-palette-extractor', 2),
  ('css-generator-suite', 2)
ON CONFLICT (tool_slug) DO UPDATE SET cost = EXCLUDED.cost;

-- 4. spend_credits ignores the client-supplied amount and uses the server cost
CREATE OR REPLACE FUNCTION public.spend_credits(_amount integer DEFAULT NULL, _tool_slug text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_credits%rowtype;
  _new_balance integer;
  _cost integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF _tool_slug IS NULL OR btrim(_tool_slug) = '' THEN
    RAISE EXCEPTION 'INVALID_TOOL';
  END IF;

  SELECT cost INTO _cost FROM public.tool_credit_costs WHERE tool_slug = _tool_slug;
  IF _cost IS NULL THEN
    RAISE EXCEPTION 'INVALID_TOOL';
  END IF;

  PERFORM public.ensure_user_account();

  SELECT * INTO _row FROM public.user_credits WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDITS_ACCOUNT';
  END IF;

  IF _cost = 0 THEN
    RETURN _row.credits;
  END IF;

  IF _row.unlimited_until IS NOT NULL AND _row.unlimited_until > now() THEN
    RETURN _row.credits;
  END IF;

  IF _row.credits < _cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  _new_balance := _row.credits - _cost;
  UPDATE public.user_credits
    SET credits = _new_balance, updated_at = now()
    WHERE user_id = _uid;

  INSERT INTO public.credit_transactions (user_id, amount, tool_slug, reason, balance_after)
  VALUES (_uid, -_cost, _tool_slug, 'tool_usage', _new_balance);

  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_credits(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text) TO authenticated;