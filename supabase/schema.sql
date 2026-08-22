-- ============================================================================
-- Ground Truth Estimator — database schema
--
-- Run this once in your Supabase project's SQL Editor (Dashboard -> SQL
-- Editor -> New query -> paste this whole file -> Run). It is safe to re-run
-- on a fresh project; it is NOT written to be re-run against a project that
-- already has this schema (it will error on the CREATE TABLE statements).
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Company',
  created_at timestamptz not null default now()
);

create table org_members (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table rate_items (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  kind       text not null check (kind in ('labour', 'plant', 'material')),
  name       text not null,
  unit       text not null default 'unit',
  rate       numeric not null default 0,
  sort_order integer not null default 0
);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null default 'New Project',
  client       text not null default '',
  location     text not null default '',
  prepared_by  text not null default '',
  project_date date not null default current_date,
  notes        text not null default '',
  markups      jsonb not null default '{"preliminaries":8,"contingency":5,"overhead":6,"margin":8,"principalCost":5,"gst":10}'::jsonb,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  color      text not null default 'var(--cat-earth)',
  sort_order integer not null default 0
);

create table line_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  description text not null default 'New line item',
  unit        text not null default 'unit',
  qty         numeric not null default 0,
  labour      jsonb not null default '[]'::jsonb,
  plant       jsonb not null default '[]'::jsonb,
  material    jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0
);

create table risk_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  category    text not null default 'other' check (category in ('weather', 'geotechnical', 'programme', 'market', 'safety', 'other')),
  description text not null default 'New risk',
  probability numeric not null default 0 check (probability >= 0 and probability <= 100),
  impact      numeric not null default 0,
  notes       text not null default '',
  sort_order  integer not null default 0
);

create index rate_items_org_idx   on rate_items(org_id);
create index projects_org_idx     on projects(org_id);
create index categories_proj_idx  on categories(project_id);
create index line_items_cat_idx   on line_items(category_id);
create index risk_items_proj_idx  on risk_items(project_id);

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- is_org_member() is SECURITY DEFINER so it can read org_members without
-- being blocked by org_members' own RLS policy (which would otherwise
-- recurse). Every table is scoped to "the caller belongs to this row's org".
-- ----------------------------------------------------------------------------

create or replace function is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members
    where org_id = check_org_id and user_id = auth.uid()
  );
$$;

alter table organizations enable row level security;
alter table org_members   enable row level security;
alter table rate_items    enable row level security;
alter table projects      enable row level security;
alter table categories    enable row level security;
alter table line_items    enable row level security;
alter table risk_items    enable row level security;

create policy "members can view their org" on organizations
  for select using (is_org_member(id));

create policy "members can view their memberships" on org_members
  for select using (is_org_member(org_id));

create policy "members can manage their rate items" on rate_items
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage their projects" on projects
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage their categories" on categories
  for all using (
    is_org_member((select org_id from projects where id = project_id))
  ) with check (
    is_org_member((select org_id from projects where id = project_id))
  );

create policy "members can manage their line items" on line_items
  for all using (
    is_org_member((select org_id from projects p join categories c on c.project_id = p.id where c.id = category_id))
  ) with check (
    is_org_member((select org_id from projects p join categories c on c.project_id = p.id where c.id = category_id))
  );

create policy "members can manage their risk items" on risk_items
  for all using (
    is_org_member((select org_id from projects where id = project_id))
  ) with check (
    is_org_member((select org_id from projects where id = project_id))
  );

-- keep projects.updated_at current
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- New user -> new organization, with a starter rate library
--
-- Fires on every new auth.users row (email/password signup, magic link,
-- OAuth — whatever you enable later). Gives each new account its own
-- workspace immediately, seeded with the same indicative Australian civil
-- rates the original prototype shipped with.
-- ----------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name) values ('My Company') returning id into new_org_id;
  insert into org_members (org_id, user_id, role) values (new_org_id, new.id, 'owner');

  insert into rate_items (org_id, kind, name, unit, rate, sort_order) values
    (new_org_id, 'labour', 'Trades Assistant', 'hour', 62, 1),
    (new_org_id, 'labour', 'Leading Hand', 'hour', 75, 2),
    (new_org_id, 'labour', 'Plant Operator', 'hour', 70, 3),
    (new_org_id, 'labour', 'Foreman / Supervisor', 'hour', 95, 4),
    (new_org_id, 'labour', 'Surveyor / Setout', 'hour', 85, 5),
    (new_org_id, 'labour', 'Traffic Controller', 'hour', 58, 6),

    (new_org_id, 'plant', 'Excavator 20t', 'hour', 165, 1),
    (new_org_id, 'plant', 'Excavator 30t', 'hour', 210, 2),
    (new_org_id, 'plant', 'Dozer D6', 'hour', 195, 3),
    (new_org_id, 'plant', 'Grader 140M', 'hour', 175, 4),
    (new_org_id, 'plant', 'Smooth Drum Roller', 'hour', 110, 5),
    (new_org_id, 'plant', 'Padfoot Roller', 'hour', 115, 6),
    (new_org_id, 'plant', 'Water Cart 10kL', 'hour', 95, 7),
    (new_org_id, 'plant', 'Tipper Truck 6WD', 'hour', 120, 8),
    (new_org_id, 'plant', 'Asphalt Paver', 'hour', 260, 9),
    (new_org_id, 'plant', 'Concrete Pump (Line)', 'hour', 180, 10),
    (new_org_id, 'plant', 'Mobile Crane 25t', 'hour', 220, 11),

    (new_org_id, 'material', 'Concrete 32MPa', 'm3', 310, 1),
    (new_org_id, 'material', 'Reinforcement (supply, cut & bend)', 'tonne', 2850, 2),
    (new_org_id, 'material', 'Formwork (supply & erect, general)', 'm2', 75, 3),
    (new_org_id, 'material', 'Crushed Rock Base (Type 2.2)', 'tonne', 58, 4),
    (new_org_id, 'material', 'Asphalt AC14', 'tonne', 145, 5),
    (new_org_id, 'material', 'Sand / Aggregate Bedding', 'tonne', 45, 6),
    (new_org_id, 'material', 'RC Pipe 375mm', 'm', 210, 7),
    (new_org_id, 'material', 'RC Pipe 600mm', 'm', 340, 8),
    (new_org_id, 'material', 'Precast Box Culvert 1200x600', 'm', 650, 9),
    (new_org_id, 'material', 'Precast Deck Unit (supply)', 'm', 2200, 10),
    (new_org_id, 'material', 'Geofabric', 'm2', 4.2, 11),
    (new_org_id, 'material', 'Topsoil', 'm3', 38, 12);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- Optional: one-click demo project, using the calling org's own rate items.
-- Call from the app with: select seed_example_project('<org_id>', '<user_id>');
-- ----------------------------------------------------------------------------

create or replace function seed_example_project(p_org_id uuid, p_created_by uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  proj_id uuid;
  cat_earth uuid;
  cat_pave uuid;
  cat_drain uuid;
  cat_struct uuid;
  r record;
  rate_map jsonb := '{}'::jsonb;
begin
  if not is_org_member(p_org_id) then
    raise exception 'not a member of this organization';
  end if;

  for r in select id, name from rate_items where org_id = p_org_id loop
    rate_map := rate_map || jsonb_build_object(r.name, r.id::text);
  end loop;

  insert into projects (org_id, name, client, location, prepared_by, notes, created_by)
  values (
    p_org_id,
    'Riverbend Estate — Stage 3 Civil Works',
    'Riverbend Developments Pty Ltd',
    'Ipswich, QLD',
    '',
    'Concept-stage estimate for internal budget review. Quantities from preliminary civil design; rates to be firmed up against subcontractor and supplier quotes prior to tender.',
    p_created_by
  ) returning id into proj_id;

  insert into categories (project_id, name, color, sort_order) values (proj_id, 'Earthworks & Site Works', 'var(--cat-earth)', 1) returning id into cat_earth;
  insert into categories (project_id, name, color, sort_order) values (proj_id, 'Roads & Pavements', 'var(--cat-pave)', 2) returning id into cat_pave;
  insert into categories (project_id, name, color, sort_order) values (proj_id, 'Drainage & Pipelines', 'var(--cat-drain)', 3) returning id into cat_drain;
  insert into categories (project_id, name, color, sort_order) values (proj_id, 'Structures (Bridges & Culverts)', 'var(--cat-struct)', 4) returning id into cat_struct;

  insert into line_items (category_id, description, unit, qty, labour, plant, material, sort_order) values
    (cat_earth, 'Bulk excavation to spoil', 'm3', 5000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Plant Operator', 'perUnit', 0.018)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Excavator 30t', 'perUnit', 0.018), jsonb_build_object('ref', rate_map->>'Tipper Truck 6WD', 'perUnit', 0.05)),
      '[]', 1),
    (cat_earth, 'Cut to fill', 'm3', 12000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Plant Operator', 'perUnit', 0.01)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Dozer D6', 'perUnit', 0.012), jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 0.008)),
      '[]', 2),
    (cat_earth, 'Compaction of engineered fill', 'm3', 12000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Plant Operator', 'perUnit', 0.006)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Padfoot Roller', 'perUnit', 0.006), jsonb_build_object('ref', rate_map->>'Water Cart 10kL', 'perUnit', 0.003)),
      '[]', 3),
    (cat_earth, 'Topsoil respread & seeding prep', 'm2', 8000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 0.01)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 0.004)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Topsoil', 'perUnit', 0.15)), 4);

  insert into line_items (category_id, description, unit, qty, labour, plant, material, sort_order) values
    (cat_pave, 'Subgrade preparation & proof roll', 'm2', 15000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Plant Operator', 'perUnit', 0.004)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Grader 140M', 'perUnit', 0.004), jsonb_build_object('ref', rate_map->>'Smooth Drum Roller', 'perUnit', 0.004)),
      '[]', 1),
    (cat_pave, 'Crushed rock base course, 150mm compacted', 'm2', 15000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 0.005)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Grader 140M', 'perUnit', 0.003), jsonb_build_object('ref', rate_map->>'Padfoot Roller', 'perUnit', 0.003), jsonb_build_object('ref', rate_map->>'Water Cart 10kL', 'perUnit', 0.002)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Crushed Rock Base (Type 2.2)', 'perUnit', 0.27)), 2),
    (cat_pave, 'Asphalt wearing course, 40mm AC10', 'm2', 15000,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 0.003)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Asphalt Paver', 'perUnit', 0.003), jsonb_build_object('ref', rate_map->>'Smooth Drum Roller', 'perUnit', 0.003)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Asphalt AC14', 'perUnit', 0.1)), 3);

  insert into line_items (category_id, description, unit, qty, labour, plant, material, sort_order) values
    (cat_drain, 'Trench excavation, bedding & backfill', 'm', 1200,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Plant Operator', 'perUnit', 0.05), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 0.05)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 0.05)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Sand / Aggregate Bedding', 'perUnit', 0.3)), 1),
    (cat_drain, 'Supply & lay RC pipe, 375mm', 'm', 800,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 0.04), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 0.04)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 0.02)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'RC Pipe 375mm', 'perUnit', 1)), 2),
    (cat_drain, 'Supply & install precast box culvert, 1200x600', 'm', 60,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 0.3), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 0.3)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Mobile Crane 25t', 'perUnit', 0.25), jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 0.2)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Precast Box Culvert 1200x600', 'perUnit', 1)), 3),
    (cat_drain, 'Stormwater pit construction', 'each', 25,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 4), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 4)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 2), jsonb_build_object('ref', rate_map->>'Concrete Pump (Line)', 'perUnit', 1)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Concrete 32MPa', 'perUnit', 1.2), jsonb_build_object('ref', rate_map->>'Reinforcement (supply, cut & bend)', 'perUnit', 0.08)), 4);

  insert into line_items (category_id, description, unit, qty, labour, plant, material, sort_order) values
    (cat_struct, 'Bulk excavation for footings', 'm3', 400,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Plant Operator', 'perUnit', 0.03)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Excavator 20t', 'perUnit', 0.03)),
      '[]', 1),
    (cat_struct, 'Reinforced concrete footings & piers', 'm3', 180,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 1.2), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 1.2)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Concrete Pump (Line)', 'perUnit', 0.3), jsonb_build_object('ref', rate_map->>'Mobile Crane 25t', 'perUnit', 0.1)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Concrete 32MPa', 'perUnit', 1.05), jsonb_build_object('ref', rate_map->>'Reinforcement (supply, cut & bend)', 'perUnit', 0.12), jsonb_build_object('ref', rate_map->>'Formwork (supply & erect, general)', 'perUnit', 2.5)), 2),
    (cat_struct, 'Precast deck units — supply & install', 'm', 40,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 0.8), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 0.8)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Mobile Crane 25t', 'perUnit', 0.6)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Precast Deck Unit (supply)', 'perUnit', 1)), 3),
    (cat_struct, 'Bridge barriers & handrail', 'm', 80,
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Leading Hand', 'perUnit', 0.5), jsonb_build_object('ref', rate_map->>'Trades Assistant', 'perUnit', 0.5)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Mobile Crane 25t', 'perUnit', 0.1)),
      jsonb_build_array(jsonb_build_object('ref', rate_map->>'Concrete 32MPa', 'perUnit', 0.15), jsonb_build_object('ref', rate_map->>'Reinforcement (supply, cut & bend)', 'perUnit', 0.02)), 4);

  insert into risk_items (project_id, category, description, probability, impact, notes, sort_order) values
    (proj_id, 'weather', 'Wet weather delay to earthworks & pavement activities', 40, 45000, 'Use the Risk & Location tab to check seasonal rainfall for the site before firming this up.', 1),
    (proj_id, 'geotechnical', 'Latent underground services or unsuitable material in cut areas', 25, 60000, 'Allowance based on similar past sites; refine once a geotech report is available.', 2),
    (proj_id, 'market', 'Steel and fuel price escalation over the construction period', 30, 20000, '', 3);

  return proj_id;
end;
$$;
