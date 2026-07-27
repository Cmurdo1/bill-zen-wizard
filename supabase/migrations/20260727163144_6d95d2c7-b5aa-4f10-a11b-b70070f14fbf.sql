
REVOKE EXECUTE ON FUNCTION public.get_webhook_logs() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_job_leads() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_job_lead_status(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_system_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_all_feedback() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_subscription_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_admin_access() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_feedback_token(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_webhook_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_lead_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_feedback() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_feedback_token(uuid, uuid) TO authenticated, anon;
