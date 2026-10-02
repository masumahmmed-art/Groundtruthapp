-- ============================================================================
-- Ground Truth Estimator — migration 007: supplier invoice inbox
--
-- Supplier invoices (PDFs in a private bucket), their coded lines, a usage
-- counter for AI invoice reading with a free monthly allowance, GST on actual
-- costs (needed for TPAR), and an approve function that posts coded lines into
-- actual_costs in one transaction. Run after 006.
-- ============================================================================

-- --- Billing / allowance fields on the workspace -----------------------------
alter table public.organizations
  add column free_invoice_reads_per_month integer not null default 20 check (free_invoice_reads_per_month >= 0),
  -- 'none' until Stripe is set up; 'active' lets reads continue past the free allowance (billed per invoice).
  add column billing_status text not null default 'none' check (billing_status in ('none','active','past_due','cancelled')),
  add column stripe_customer_id text;

-- Members could already update their org (name, currency, units). Billing fields
-- must only change server-side (Stripe webhook / service role), so block them here.
create or replace function public.protect_org_billing_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated','anon') and (
    new.free_invoice_reads_per_month is distinct from old.free_invoice_reads_per_month or
    new.billing_status is distinct from old.billing_status or
    new.stripe_customer_id is distinct from old.stripe_customer_id
  ) then
    raise exception 'billing fields can only be changed by the billing system';
  end if;
  return new;
end;
$$;

create trigger organizations_protect_billing
  before update on public.organizations
  for each row execute function public.protect_org_billing_fields();

-- --- GST + invoice link on actual costs --------------------------------------
alter table public.actual_costs
  add column gst_amount numeric not null default 0;

-- --- Supplier invoices --------------------------------------------------------
create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'uploaded'
    check (status in ('uploaded','reading','needs_review','approved','rejected')),
  file_path text not null,
  file_name text not null default '',
  file_size bigint,
  -- Header fields (filled by AI reading, then checked by a person)
  supplier_name_on_invoice text not null default '',
  abn_on_invoice text not null default '',
  invoice_number text not null default '',
  invoice_date date,
  due_date date,
  subtotal_ex_gst numeric not null default 0,
  gst numeric not null default 0,
  total numeric not null default 0,
  extracted jsonb,
  extraction_error text,
  notes text not null default '',
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);

create index supplier_invoices_org_idx on public.supplier_invoices(org_id, created_at desc);
create index supplier_invoices_supplier_idx on public.supplier_invoices(supplier_id);

create trigger supplier_invoices_set_updated_at
  before update on public.supplier_invoices
  for each row execute function public.set_updated_at();

alter table public.supplier_invoices enable row level security;

create policy "members can manage their supplier invoices" on public.supplier_invoices
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- Approved invoices are locked: nobody edits or deletes them through the API.
create or replace function public.lock_approved_invoice()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status = 'approved' and current_user in ('authenticated','anon') then
    raise exception 'approved invoices cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger supplier_invoices_lock_approved
  before update or delete on public.supplier_invoices
  for each row execute function public.lock_approved_invoice();

create trigger supplier_invoices_audit
  after insert or update or delete on public.supplier_invoices
  for each row execute function public.write_audit_log();

-- --- Invoice lines ------------------------------------------------------------
create table public.supplier_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  description text not null default '',
  quantity numeric not null default 0,
  unit text not null default '',
  unit_price numeric not null default 0,
  amount_ex_gst numeric not null default 0,
  gst numeric not null default 0,
  -- Coding: where the cost lands
  project_id uuid references public.projects(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  cost_type text not null default 'material'
    check (cost_type in ('labour','plant','material','subcontract')),
  rate_item_id uuid references public.rate_items(id) on delete set null,
  actual_cost_id uuid references public.actual_costs(id) on delete set null,
  sort_order integer not null default 0
);

create index supplier_invoice_lines_invoice_idx on public.supplier_invoice_lines(invoice_id);

alter table public.supplier_invoice_lines enable row level security;

create policy "members can manage their invoice lines" on public.supplier_invoice_lines
  for all
  using (public.is_org_member((select org_id from public.supplier_invoices i where i.id = invoice_id)))
  with check (public.is_org_member((select org_id from public.supplier_invoices i where i.id = invoice_id)));

-- Lines of an approved invoice are locked too.
-- Not security definer on purpose: current_user must stay the caller's role.
create or replace function public.lock_approved_invoice_lines()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_status text;
begin
  select status into v_status from supplier_invoices
  where id = case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  if v_status = 'approved' and current_user in ('authenticated','anon') then
    raise exception 'lines of an approved invoice cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger supplier_invoice_lines_lock_approved
  before insert or update or delete on public.supplier_invoice_lines
  for each row execute function public.lock_approved_invoice_lines();


-- --- AI usage counter ------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature text not null check (feature in ('invoice_read')),
  invoice_id uuid references public.supplier_invoices(id) on delete set null,
  billable boolean not null default false,   -- true once past the free allowance
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_org_month_idx on public.ai_usage(org_id, feature, created_at);

alter table public.ai_usage enable row level security;

-- Members can see their usage; only the server (service role) records it.
create policy "members can view their ai usage" on public.ai_usage
  for select using (public.is_org_member(org_id));

-- Reads used this calendar month (Australia/Brisbane) and the allowance left.
create or replace function public.invoice_read_allowance(p_org_id uuid)
returns table (used integer, free_allowance integer, billing_status text, can_read boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    u.used,
    o.free_invoice_reads_per_month,
    o.billing_status,
    (u.used < o.free_invoice_reads_per_month) or o.billing_status = 'active'
  from organizations o
  cross join lateral (
    select count(*)::int as used
    from ai_usage a
    where a.org_id = o.id
      and a.feature = 'invoice_read'
      and a.created_at >= (date_trunc('month', now() at time zone 'Australia/Brisbane') at time zone 'Australia/Brisbane')
  ) u
  where o.id = p_org_id and public.is_org_member(p_org_id);
$$;

revoke execute on function public.invoice_read_allowance(uuid) from public, anon;
grant execute on function public.invoice_read_allowance(uuid) to authenticated;

-- --- Approve: post coded lines into actual_costs atomically ---------------------
create or replace function public.approve_supplier_invoice(p_invoice_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
  ln record;
  v_cost_id uuid;
  v_count integer := 0;
begin
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  if not found or not is_org_member(inv.org_id) then
    raise exception 'invoice not found';
  end if;
  if inv.status = 'approved' then
    raise exception 'invoice is already approved';
  end if;
  if inv.supplier_id is null then
    raise exception 'link the invoice to a supplier before approving';
  end if;
  if not exists (select 1 from supplier_invoice_lines where invoice_id = inv.id) then
    raise exception 'the invoice has no lines to post';
  end if;
  if exists (
    select 1 from supplier_invoice_lines l
    left join projects p on p.id = l.project_id
    where l.invoice_id = inv.id and (l.project_id is null or p.org_id is distinct from inv.org_id)
  ) then
    raise exception 'every line needs a project from this workspace';
  end if;

  for ln in
    select * from supplier_invoice_lines where invoice_id = inv.id order by sort_order
  loop
    insert into actual_costs (project_id, category_id, entry_date, cost_type, rate_item_id,
                              quantity, amount, gst_amount, description, supplier_id)
    values (
      ln.project_id,
      ln.category_id,
      coalesce(inv.invoice_date, current_date),
      ln.cost_type,
      case when ln.cost_type = 'subcontract' then null else ln.rate_item_id end,
      case when ln.rate_item_id is not null and ln.cost_type <> 'subcontract' then ln.quantity else 0 end,
      ln.amount_ex_gst,
      ln.gst,
      left(trim(both ' ' from concat_ws(' — ', nullif(inv.invoice_number, ''), nullif(ln.description, ''))), 500),
      inv.supplier_id
    )
    returning id into v_cost_id;

    update supplier_invoice_lines set actual_cost_id = v_cost_id where id = ln.id;
    v_count := v_count + 1;
  end loop;

  update supplier_invoices
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = inv.id;

  return v_count;
end;
$$;

revoke execute on function public.approve_supplier_invoice(uuid) from public, anon;
grant execute on function public.approve_supplier_invoice(uuid) to authenticated;

-- --- Private storage bucket for invoice PDFs ---------------------------------------
-- Files are stored as <org_id>/<invoice_id>.pdf, 10 MB max, PDF and images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "org members can manage their invoice files" on storage.objects
  for all
  using (bucket_id = 'invoices' and public.is_org_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'invoices' and public.is_org_member(((storage.foldername(name))[1])::uuid));
