-- ============================================================================
-- Ground Truth Estimator — migration 008: teams and invoice approvals
--
-- * Team invitations: owners invite people by email; accepting joins the
--   workspace (an empty auto-created workspace of the invitee is removed).
-- * Approval limits per member, a project manager per project, and an
--   optional two-step invoice approval:
--     needs_review --submit--> awaiting_check --check (PM)--> awaiting_approval
--       --approve (within limit)--> approved
--   A checker whose limit covers the invoice approves in the same click.
--   Nobody approves an invoice they submitted (unless they're the only member).
-- * Every status change goes through a SECURITY DEFINER function and is
--   written to invoice_events; users can't set those statuses directly.
-- Run after 007.
-- ============================================================================

-- --- Members: email for display, approval limit --------------------------------
alter table public.org_members
  add column email text not null default '',
  add column approval_limit numeric check (approval_limit is null or approval_limit >= 0);

update public.org_members m set email = coalesce(u.email, '')
from auth.users u where u.id = m.user_id;

-- New signups: record the email on their owner membership too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_org_id uuid;
begin
  insert into organizations (name) values ('My Company') returning id into new_org_id;
  insert into org_members (org_id, user_id, role, email) values (new_org_id, new.id, 'owner', coalesce(new.email, ''));

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
$function$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.is_org_owner(check_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from org_members
    where org_id = check_org_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- --- Workspace approval mode ---------------------------------------------------
alter table public.organizations
  add column invoice_approval_mode text not null default 'simple'
    check (invoice_approval_mode in ('simple','two_step'));

-- Billing fields: server only. Approval mode: owners only.
create or replace function public.protect_org_billing_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated','anon') then
    if new.free_invoice_reads_per_month is distinct from old.free_invoice_reads_per_month or
       new.billing_status is distinct from old.billing_status or
       new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'billing fields can only be changed by the billing system';
    end if;
    if new.invoice_approval_mode is distinct from old.invoice_approval_mode and not public.is_org_owner(old.id) then
      raise exception 'only the workspace owner can change the approval process';
    end if;
  end if;
  return new;
end;
$$;

-- --- Project manager per project -------------------------------------------------
alter table public.projects
  add column manager_user_id uuid references auth.users(id) on delete set null;

-- --- Invitations ---------------------------------------------------------------------
create table public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  approval_limit numeric check (approval_limit is null or approval_limit >= 0),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

create unique index org_invitations_open_email_idx
  on public.org_invitations(org_id, lower(email)) where accepted_at is null;

alter table public.org_invitations enable row level security;

create policy "owners can view their invitations" on public.org_invitations
  for select using (public.is_org_owner(org_id));
create policy "owners can create invitations" on public.org_invitations
  for insert with check (public.is_org_owner(org_id) and accepted_at is null);
create policy "owners can revoke invitations" on public.org_invitations
  for delete using (public.is_org_owner(org_id));

-- What an invitee sees before accepting (workspace name, inviter, status).
create or replace function public.invitation_details(p_token uuid)
returns table (org_name text, email text, invited_by_email text, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select o.name, i.email,
         coalesce((select m.email from org_members m where m.org_id = i.org_id and m.user_id = i.invited_by), ''),
         i.expires_at < now(), i.accepted_at is not null
  from org_invitations i join organizations o on o.id = i.org_id
  where i.token = p_token and auth.uid() is not null;
$$;
revoke execute on function public.invitation_details(uuid) from public, anon;
grant execute on function public.invitation_details(uuid) to authenticated;

create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv org_invitations%rowtype;
  v_email text;
  m record;
begin
  if auth.uid() is null then raise exception 'log in first'; end if;
  select * into inv from org_invitations where token = p_token for update;
  if not found then raise exception 'this invitation link is not valid'; end if;
  if inv.accepted_at is not null then raise exception 'this invitation has already been used'; end if;
  if inv.expires_at < now() then raise exception 'this invitation has expired — ask for a new one'; end if;

  select email into v_email from auth.users where id = auth.uid();
  if lower(coalesce(v_email,'')) <> lower(inv.email) then
    raise exception 'this invitation was sent to %, but you are logged in as %', inv.email, v_email;
  end if;

  if exists (select 1 from org_members where org_id = inv.org_id and user_id = auth.uid()) then
    update org_invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
    return inv.org_id;
  end if;

  -- The app works with one workspace per person. Remove the invitee's own
  -- workspace if it's empty; refuse if it holds real work.
  for m in select org_id from org_members where user_id = auth.uid() loop
    if exists (select 1 from org_members where org_id = m.org_id and user_id <> auth.uid())
       or exists (select 1 from projects where org_id = m.org_id)
       or exists (select 1 from suppliers where org_id = m.org_id)
       or exists (select 1 from supplier_invoices where org_id = m.org_id) then
      raise exception 'you already have projects or team members in another workspace. Contact support to merge workspaces';
    end if;
  end loop;
  delete from organizations o
  where o.id in (select org_id from org_members where user_id = auth.uid());

  insert into org_members (org_id, user_id, role, email, approval_limit)
  values (inv.org_id, auth.uid(), 'member', coalesce(v_email,''), inv.approval_limit);
  update org_invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.org_id;
end;
$$;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

create or replace function public.set_member_approval_limit(p_org_id uuid, p_user_id uuid, p_limit numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_org_owner(p_org_id) then raise exception 'only the workspace owner can set approval limits'; end if;
  if p_limit is not null and p_limit < 0 then raise exception 'the limit can''t be negative'; end if;
  update org_members set approval_limit = p_limit where org_id = p_org_id and user_id = p_user_id;
end;
$$;
revoke execute on function public.set_member_approval_limit(uuid, uuid, numeric) from public, anon;
grant execute on function public.set_member_approval_limit(uuid, uuid, numeric) to authenticated;

create or replace function public.remove_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not is_org_owner(p_org_id) then raise exception 'only the workspace owner can remove people'; end if;
  if p_user_id = auth.uid() then raise exception 'you can''t remove yourself'; end if;
  delete from org_members where org_id = p_org_id and user_id = p_user_id and role <> 'owner';
  update projects set manager_user_id = null where org_id = p_org_id and manager_user_id = p_user_id;
end;
$$;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- --- Invoice workflow columns and history ------------------------------------------
alter table public.supplier_invoices drop constraint supplier_invoices_status_check;
alter table public.supplier_invoices add constraint supplier_invoices_status_check
  check (status in ('uploaded','reading','needs_review','awaiting_check','awaiting_approval','approved','rejected'));

alter table public.supplier_invoices
  add column submitted_by uuid references auth.users(id),
  add column submitted_at timestamptz,
  add column checked_by uuid references auth.users(id),
  add column checked_at timestamptz;

create table public.invoice_events (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  action text not null check (action in ('submitted','checked','approved','sent_back','rejected')),
  actor uuid references auth.users(id) default auth.uid(),
  actor_email text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index invoice_events_invoice_idx on public.invoice_events(invoice_id, created_at);
alter table public.invoice_events enable row level security;
create policy "members can view invoice history" on public.invoice_events
  for select using (public.is_org_member(org_id));

-- Users may only edit invoices (and their lines) while they're being prepared,
-- and may never set a workflow status themselves.
create or replace function public.lock_approved_invoice()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated','anon') then
    if old.status not in ('uploaded','reading','needs_review') then
      raise exception 'this invoice is % and can''t be changed', replace(old.status, '_', ' ');
    end if;
    if tg_op = 'UPDATE' and new.status not in ('uploaded','reading','needs_review') then
      raise exception 'use the approval buttons to change an invoice''s status';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  if v_status not in ('uploaded','reading','needs_review') and current_user in ('authenticated','anon') then
    raise exception 'lines can''t be changed once an invoice is submitted';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- --- Workflow helpers (internal) ----------------------------------------------------
create or replace function public._invoice_member_limit(p_org_id uuid, p_user uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  -- Owners have no limit.
  select case when role = 'owner' then 'Infinity'::numeric else approval_limit end
  from org_members where org_id = p_org_id and user_id = p_user;
$$;

create or replace function public._invoice_log(p_inv supplier_invoices, p_action text, p_note text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into invoice_events (invoice_id, org_id, action, actor, actor_email, note)
  values (p_inv.id, p_inv.org_id, p_action, auth.uid(),
          coalesce((select email from org_members where org_id = p_inv.org_id and user_id = auth.uid()), ''),
          coalesce(p_note, ''));
$$;

create or replace function public._invoice_validate(p_inv supplier_invoices)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_inv.supplier_id is null then
    raise exception 'link the invoice to a supplier first';
  end if;
  if not exists (select 1 from supplier_invoice_lines where invoice_id = p_inv.id) then
    raise exception 'the invoice has no lines';
  end if;
  if exists (
    select 1 from supplier_invoice_lines l
    left join projects p on p.id = l.project_id
    where l.invoice_id = p_inv.id and (l.project_id is null or p.org_id is distinct from p_inv.org_id)
  ) then
    raise exception 'every line needs a project from this workspace';
  end if;
end;
$$;

create or replace function public._invoice_post(p_inv supplier_invoices)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  ln record;
  v_cost_id uuid;
  v_count integer := 0;
begin
  for ln in
    select * from supplier_invoice_lines where invoice_id = p_inv.id order by sort_order
  loop
    insert into actual_costs (project_id, category_id, entry_date, cost_type, rate_item_id,
                              quantity, amount, gst_amount, description, supplier_id)
    values (
      ln.project_id, ln.category_id,
      coalesce(p_inv.invoice_date, current_date),
      ln.cost_type,
      case when ln.cost_type = 'subcontract' then null else ln.rate_item_id end,
      case when ln.rate_item_id is not null and ln.cost_type <> 'subcontract' then ln.quantity else 0 end,
      ln.amount_ex_gst, ln.gst,
      left(trim(both ' ' from concat_ws(' — ', nullif(p_inv.invoice_number, ''), nullif(ln.description, ''))), 500),
      p_inv.supplier_id
    )
    returning id into v_cost_id;
    update supplier_invoice_lines set actual_cost_id = v_cost_id where id = ln.id;
    v_count := v_count + 1;
  end loop;

  update supplier_invoices
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_inv.id;
  return v_count;
end;
$$;

-- True when the caller may not act on their own submission (more than one member).
create or replace function public._invoice_is_self(p_inv supplier_invoices)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_inv.submitted_by = auth.uid()
     and (select count(*) from org_members where org_id = p_inv.org_id) > 1;
$$;

revoke execute on function public._invoice_member_limit(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._invoice_log(supplier_invoices, text, text) from public, anon, authenticated;
revoke execute on function public._invoice_validate(supplier_invoices) from public, anon, authenticated;
revoke execute on function public._invoice_post(supplier_invoices) from public, anon, authenticated;
revoke execute on function public._invoice_is_self(supplier_invoices) from public, anon, authenticated;

-- --- Workflow actions (called by the app) ---------------------------------------------

-- Simple mode: one click approves and posts.
create or replace function public.approve_supplier_invoice(p_invoice_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
  v_mode text;
  v_count integer;
begin
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  if not found or not is_org_member(inv.org_id) then raise exception 'invoice not found'; end if;
  select invoice_approval_mode into v_mode from organizations where id = inv.org_id;
  if v_mode <> 'simple' then raise exception 'this workspace uses two-step approval — submit the invoice instead'; end if;
  if inv.status not in ('uploaded','needs_review') then raise exception 'this invoice can''t be approved from its current status'; end if;
  perform _invoice_validate(inv);
  v_count := _invoice_post(inv);
  perform _invoice_log(inv, 'approved', '');
  return v_count;
end;
$$;

create or replace function public.submit_supplier_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
begin
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  if not found or not is_org_member(inv.org_id) then raise exception 'invoice not found'; end if;
  if inv.status not in ('uploaded','needs_review') then raise exception 'only invoices being prepared can be submitted'; end if;
  perform _invoice_validate(inv);
  update supplier_invoices
  set status = 'awaiting_check', submitted_by = auth.uid(), submitted_at = now(),
      checked_by = null, checked_at = null
  where id = inv.id;
  perform _invoice_log(inv, 'submitted', '');
end;
$$;

-- Who may do the project check: the owner, or anyone (other than the
-- submitter) who is the manager of every project on the invoice. Projects
-- without a manager can be checked by any member.
create or replace function public.can_check_supplier_invoice(p_invoice_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
begin
  select * into inv from supplier_invoices where id = p_invoice_id;
  if not found or not is_org_member(inv.org_id) or inv.status <> 'awaiting_check' then return false; end if;
  if _invoice_is_self(inv) then return false; end if;
  if is_org_owner(inv.org_id) then return true; end if;
  return not exists (
    select 1 from supplier_invoice_lines l join projects p on p.id = l.project_id
    where l.invoice_id = inv.id and p.manager_user_id is not null and p.manager_user_id <> auth.uid()
  );
end;
$$;

create or replace function public.can_approve_supplier_invoice(p_invoice_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
  v_limit numeric;
begin
  select * into inv from supplier_invoices where id = p_invoice_id;
  if not found or not is_org_member(inv.org_id) or inv.status <> 'awaiting_approval' then return false; end if;
  if _invoice_is_self(inv) then return false; end if;
  v_limit := _invoice_member_limit(inv.org_id, auth.uid());
  return v_limit is not null and v_limit >= inv.total;
end;
$$;

-- Project check. If the checker's own limit covers the total, this also approves.
create or replace function public.check_supplier_invoice(p_invoice_id uuid, p_note text default '')
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
  v_limit numeric;
begin
  if not can_check_supplier_invoice(p_invoice_id) then
    raise exception 'you can''t do the project check on this invoice';
  end if;
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  update supplier_invoices set checked_by = auth.uid(), checked_at = now() where id = inv.id;
  perform _invoice_log(inv, 'checked', p_note);

  v_limit := _invoice_member_limit(inv.org_id, auth.uid());
  if v_limit is not null and v_limit >= inv.total then
    perform _invoice_validate(inv);
    perform _invoice_post(inv);
    perform _invoice_log(inv, 'approved', '');
    return 'approved';
  end if;
  update supplier_invoices set status = 'awaiting_approval' where id = inv.id;
  return 'awaiting_approval';
end;
$$;

create or replace function public.final_approve_supplier_invoice(p_invoice_id uuid, p_note text default '')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
  v_count integer;
begin
  if not can_approve_supplier_invoice(p_invoice_id) then
    raise exception 'your approval limit doesn''t cover this invoice, or you submitted it';
  end if;
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  perform _invoice_validate(inv);
  v_count := _invoice_post(inv);
  perform _invoice_log(inv, 'approved', p_note);
  return v_count;
end;
$$;

create or replace function public.send_back_supplier_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
begin
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  if not found or not is_org_member(inv.org_id) then raise exception 'invoice not found'; end if;
  if inv.status not in ('awaiting_check','awaiting_approval') then raise exception 'only submitted invoices can be sent back'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'say why you''re sending it back'; end if;
  update supplier_invoices
  set status = 'needs_review', submitted_by = null, submitted_at = null, checked_by = null, checked_at = null
  where id = inv.id;
  perform _invoice_log(inv, 'sent_back', p_reason);
end;
$$;

create or replace function public.reject_supplier_invoice(p_invoice_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  inv supplier_invoices%rowtype;
begin
  select * into inv from supplier_invoices where id = p_invoice_id for update;
  if not found or not is_org_member(inv.org_id) then raise exception 'invoice not found'; end if;
  if inv.status in ('approved','rejected') then raise exception 'this invoice is already %', inv.status; end if;
  update supplier_invoices set status = 'rejected' where id = inv.id;
  perform _invoice_log(inv, 'rejected', p_reason);
end;
$$;

revoke execute on function public.approve_supplier_invoice(uuid) from public, anon;
revoke execute on function public.submit_supplier_invoice(uuid) from public, anon;
revoke execute on function public.can_check_supplier_invoice(uuid) from public, anon;
revoke execute on function public.can_approve_supplier_invoice(uuid) from public, anon;
revoke execute on function public.check_supplier_invoice(uuid, text) from public, anon;
revoke execute on function public.final_approve_supplier_invoice(uuid, text) from public, anon;
revoke execute on function public.send_back_supplier_invoice(uuid, text) from public, anon;
revoke execute on function public.reject_supplier_invoice(uuid, text) from public, anon;
grant execute on function public.approve_supplier_invoice(uuid) to authenticated;
grant execute on function public.submit_supplier_invoice(uuid) to authenticated;
grant execute on function public.can_check_supplier_invoice(uuid) to authenticated;
grant execute on function public.can_approve_supplier_invoice(uuid) to authenticated;
grant execute on function public.check_supplier_invoice(uuid, text) to authenticated;
grant execute on function public.final_approve_supplier_invoice(uuid, text) to authenticated;
grant execute on function public.send_back_supplier_invoice(uuid, text) to authenticated;
grant execute on function public.reject_supplier_invoice(uuid, text) to authenticated;
