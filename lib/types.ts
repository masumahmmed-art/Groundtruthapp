-- Adds the "Major Category" grouping used by the new Dashboard tab.
-- Run this once in Supabase's SQL Editor (Dashboard -> SQL Editor -> New query),
-- paste the whole thing, then click Run.

alter table categories add column if not exists major_category text;
