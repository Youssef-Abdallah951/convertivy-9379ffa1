-- Transaction log for all credit changes
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  tool_slug text,
  reason text NOT NULL DEFAULT 'tool_usage',
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own transactions"
  ON public.credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all transactions"
  ON public.credit_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Prevent users from modifying their own balance manually.
-- Deduction happens exclusively through the security-definer function below.
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;

-- Secure, server-side credit deduction with logging
CREATE OR REPLACE FUNCTION public.spend_credits(_amount integer, _tool_slug text DEFAULT NULL)
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

  SELECT * INTO _row FROM public.user_credits WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDITS_ACCOUNT';
  END IF;

  -- Active unlimited subscription: no deduction
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

-- Realtime so the balance updates instantly everywhere
ALTER TABLE public.user_credits REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_credits;