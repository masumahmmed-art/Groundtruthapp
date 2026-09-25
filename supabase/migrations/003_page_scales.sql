-- ============================================================================
-- Ground Truth Estimator — migration 003: per-page drawing scales
--
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor ->
-- New query -> paste this whole file -> Run), AFTER 002_takeoff.sql.
-- Safe to run more than once.
--
-- Adds drawings.page_scales, one scale per page number:
--   { "1": { "px_per_unit": 2.2677, "unit": "m" }, "3": { ... } }
-- and copies each drawing's existing single scale onto the page it was
-- calibrated on. The old scale_px_per_unit / scale_unit / scale_page columns
-- are kept (unused by new code) so older deployments keep working.
-- No new RLS policy is needed: the column lives on drawings, which is
-- already scoped by "members can manage their drawings".
-- ============================================================================

alter table drawings
  add column if not exists page_scales jsonb not null default '{}'::jsonb;

update drawings
set page_scales = jsonb_build_object(
  scale_page::text,
  jsonb_build_object('px_per_unit', scale_px_per_unit, 'unit', scale_unit)
)
where scale_px_per_unit is not null
  and page_scales = '{}'::jsonb;
