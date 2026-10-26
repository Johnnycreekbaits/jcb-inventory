-- How many people worked a production batch (with make_minutes = actual labor). Null = not entered (counted as 1).
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.production_batches
  add column if not exists people integer;

alter table public.production_batches drop constraint if exists production_batches_people_check;
alter table public.production_batches add constraint production_batches_people_check check (people is null or people > 0);
