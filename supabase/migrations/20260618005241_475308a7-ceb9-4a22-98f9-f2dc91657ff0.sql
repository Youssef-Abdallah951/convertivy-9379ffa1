-- Notifications table
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_request_id uuid NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update notifications"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_admin_notifications_updated_at
  BEFORE UPDATE ON public.admin_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a notification when a payment request is submitted
CREATE OR REPLACE FUNCTION public.notify_admin_on_payment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (payment_request_id, user_id, status)
  VALUES (NEW.id, NEW.user_id, 'pending');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admin_on_payment_request
  AFTER INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_payment_request();

-- Mark notification processed on approve
CREATE OR REPLACE FUNCTION public.approve_payment_request(_request_id uuid, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.payment_requests%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized';
  end if;

  select * into r from public.payment_requests where id = _request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Already reviewed'; end if;

  if r.package = 'unlimited' then
    insert into public.user_credits (user_id, credits, unlimited_until)
    values (r.user_id, 0, now() + interval '30 days')
    on conflict (user_id) do update
      set unlimited_until = greatest(coalesce(public.user_credits.unlimited_until, now()), now()) + interval '30 days',
          updated_at = now();
  else
    insert into public.user_credits (user_id, credits)
    values (r.user_id, r.credits_amount)
    on conflict (user_id) do update
      set credits = public.user_credits.credits + r.credits_amount,
          updated_at = now();
  end if;

  update public.payment_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), admin_notes = _notes
  where id = _request_id;

  update public.admin_notifications
  set status = 'processed', is_read = true, updated_at = now()
  where payment_request_id = _request_id;
end;
$function$;

-- Mark notification processed on reject
CREATE OR REPLACE FUNCTION public.reject_payment_request(_request_id uuid, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized';
  end if;
  update public.payment_requests
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), admin_notes = _notes
  where id = _request_id and status = 'pending';

  update public.admin_notifications
  set status = 'processed', is_read = true, updated_at = now()
  where payment_request_id = _request_id;
end;
$function$;

-- Realtime
ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;