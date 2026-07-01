REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_credits(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_payment_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_payment_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_account() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_admin_on_payment_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;