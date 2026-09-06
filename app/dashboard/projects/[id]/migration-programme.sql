-- Adds the category-level schedule ("Programme") used by the new Programme
-- tab and, later, Earned Value. Run this once in Supabase's SQL Editor
-- (Dashboard -> SQL Editor -> New query), paste the whole thing, then Run.

alter table categories add column if not exists planned_start date;
alter table categories add column if not exists planned_end date;
