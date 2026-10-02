-- ============================================================================
-- Ground Truth Estimator — migration 006: tighten function permissions
--
-- Already applied to the production project on 2 Oct 2026.
-- ============================================================================

-- handle_new_user only runs as the auth.users trigger; nobody should call it through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- seed_example_project is used by signed-in users (it checks membership)
revoke execute on function public.seed_example_project(uuid, uuid) from public, anon;
grant execute on function public.seed_example_project(uuid, uuid) to authenticated;

alter function public.set_updated_at() set search_path to 'public';
