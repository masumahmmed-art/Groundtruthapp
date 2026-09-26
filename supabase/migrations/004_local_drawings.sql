-- ============================================================================
-- Ground Truth Estimator — migration 004: drawings kept on the user's PC
--
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor ->
-- New query -> paste this whole file -> Run), AFTER 003_page_scales.sql and
-- BEFORE deploying the code that adds drawings without uploading them.
-- Safe to run more than once. Nothing is removed.
--
-- New drawings are no longer uploaded to Storage: the PDF stays on the
-- user's computer and only its details are saved here. The fingerprint
-- (SHA-256 of the file's bytes) lets the app confirm that a file opened
-- later — on another PC, or by a colleague — is exactly the same file the
-- measurements were taken on.
--
-- Drawings uploaded before this change keep their storage_path and keep
-- loading from Storage as before.
-- ============================================================================

alter table drawings add column if not exists file_hash text;     -- SHA-256, hex; null for older uploaded drawings
alter table drawings add column if not exists file_size bigint;   -- bytes; shown when asking for the file
alter table drawings alter column storage_path drop not null;     -- null = the PDF is kept on users' PCs
