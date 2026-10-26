-- Time it took to make each production batch, in minutes (null = not entered).
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.production_batches
  add column if not exists make_minutes integer;

alter table public.production_batches drop constraint if exists production_batches_make_minutes_check;
alter table public.production_batches add constraint production_batches_make_minutes_check check (make_minutes is null or make_minutes > 0);
