-- ============================================================================
-- Ground Truth Estimator — migration 005: supplier register + audit log
--
-- Already applied to the production project on 2 Oct 2026. Kept here so the
-- repo matches the database. Run after 004_local_drawings.sql on any new copy.
-- ============================================================================

-- ABN checksum (ATO algorithm): subtract 1 from first digit, weight, sum mod 89 = 0
create or replace function public.is_valid_abn(p_abn text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $$
declare
  weights int[] := array[10,1,3,5,7,9,11,13,15,17,19];
  total int := 0;
  d int;
  i int;
begin
  if p_abn is null or p_abn !~ '^\d{11}$' then
    return false;
  end if;
  for i in 1..11 loop
    d := substr(p_abn, i, 1)::int;
    if i = 1 then d := d - 1; end if;
    total := total + d * weights[i];
  end loop;
  return total % 89 = 0;
end;
$$;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  abn text not null check (public.is_valid_abn(abn)),
  legal_name text not null default '',
  trading_name text not null default '',
  supplier_type text not null default 'other'
    check (supplier_type in ('plant_hire','materials','subcontractor','consultant','other')),
  gst_registered boolean,
  abn_status text,
  abn_checked_at timestamptz,
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  insurance_expiry date,
  licence_number text not null default '',
  licence_expiry date,
  notes text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, abn)
);

create index suppliers_org_id_idx on public.suppliers(org_id);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

create policy "members can manage their suppliers" on public.suppliers
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

alter table public.actual_costs
  add column supplier_id uuid references public.suppliers(id) on delete set null;

create index actual_costs_supplier_id_idx on public.actual_costs(supplier_id);

create or replace function public.check_actual_cost_supplier_org()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.supplier_id is not null and not exists (
    select 1 from suppliers s join projects p on p.org_id = s.org_id
    where s.id = new.supplier_id and p.id = new.project_id
  ) then
    raise exception 'supplier does not belong to this project''s workspace';
  end if;
  return new;
end;
$$;

create trigger actual_costs_check_supplier_org
  before insert or update of supplier_id, project_id on public.actual_costs
  for each row execute function public.check_actual_cost_supplier_org();

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

create index audit_log_org_record_idx on public.audit_log(org_id, table_name, record_id);

alter table public.audit_log enable row level security;

create policy "members can view their audit log" on public.audit_log
  for select using (public.is_org_member(org_id));

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org uuid;
begin
  v_org := (rec->>'org_id')::uuid;
  if v_org is null and rec ? 'project_id' then
    select org_id into v_org from projects where id = (rec->>'project_id')::uuid;
  end if;
  if v_org is null then
    return coalesce(new, old);
  end if;
  insert into audit_log (org_id, table_name, record_id, action, old_data, new_data)
  values (
    v_org, tg_table_name, (rec->>'id')::uuid, lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger suppliers_audit
  after insert or update or delete on public.suppliers
  for each row execute function public.write_audit_log();

create trigger actual_costs_audit
  after insert or update or delete on public.actual_costs
  for each row execute function public.write_audit_log();

revoke execute on function public.write_audit_log() from public, anon, authenticated;
revoke execute on function public.check_actual_cost_supplier_org() from public, anon, authenticated;
