-- ============================================================================
-- Ground Truth Estimator — migration 002: 2D drawing takeoff
--
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor ->
-- New query -> paste this whole file -> Run), AFTER the original
-- supabase/schema.sql. Safe to run once on top of the existing schema.
--
-- Adds:
--   - a private "drawings" Storage bucket (holds the uploaded PDF files)
--   - drawings            : one row per uploaded PDF, plus its scale calibration
--   - takeoff_measurements: one row per length/area/count traced on a drawing
-- Both are scoped to the project's organisation via the same
-- is_org_member() function and RLS pattern used by the rest of the schema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table drawings (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  name               text not null default 'Drawing',
  storage_path       text not null,               -- path inside the "drawings" bucket
  page_count         integer not null default 1,
  scale_px_per_unit  numeric,                      -- null until calibrated
  scale_unit         text not null default 'm',    -- 'm' or 'mm' etc, whatever the user calibrated against
  scale_page         integer not null default 1,   -- which page the calibration was done on
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now()
);

create table takeoff_measurements (
  id            uuid primary key default gen_random_uuid(),
  drawing_id    uuid not null references drawings(id) on delete cascade,
  page_number   integer not null default 1,
  kind          text not null check (kind in ('length', 'area', 'count')),
  label         text not null default '',
  geometry      jsonb not null,               -- [{x,y}, ...] in PDF page-point coordinates (scale = 1 CSS px per PDF point at render time)
  value         numeric not null default 0,   -- computed length (scale_unit), area (scale_unit^2), or count (each)
  line_item_id  uuid references line_items(id) on delete set null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index drawings_project_idx            on drawings(project_id);
create index takeoff_measurements_drawing_idx on takeoff_measurements(drawing_id);

-- ----------------------------------------------------------------------------
-- Row Level Security (same "caller belongs to this row's org" pattern as
-- categories / line_items, joined up through projects)
-- ----------------------------------------------------------------------------

alter table drawings              enable row level security;
alter table takeoff_measurements  enable row level security;

create policy "members can manage their drawings" on drawings
  for all using (
    is_org_member((select org_id from projects where id = project_id))
  ) with check (
    is_org_member((select org_id from projects where id = project_id))
  );

create policy "members can manage their takeoff measurements" on takeoff_measurements
  for all using (
    is_org_member((
      select p.org_id from projects p
      join drawings d on d.project_id = p.id
      where d.id = drawing_id
    ))
  ) with check (
    is_org_member((
      select p.org_id from projects p
      join drawings d on d.project_id = p.id
      where d.id = drawing_id
    ))
  );

-- ----------------------------------------------------------------------------
-- Storage bucket for uploaded drawing PDFs
--
-- Private bucket. Files are stored at "<org_id>/<project_id>/<drawing_id>.pdf"
-- so the same org-membership check can be reused on the path's first folder
-- segment — nobody outside the organisation can read or write these files,
-- enforced at the storage layer, same as the database tables above.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', false)
on conflict (id) do nothing;

create policy "org members can manage their drawing files" on storage.objects
  for all using (
    bucket_id = 'drawings' and is_org_member((storage.foldername(name))[1]::uuid)
  ) with check (
    bucket_id = 'drawings' and is_org_member((storage.foldername(name))[1]::uuid)
  );
