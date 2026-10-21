-- Loose baits from 2026-11-01: JCB Manufacturing delivers LOOSE soft-plastic baits to Johnny Creek Baits, LLC
-- at $0.10/bait; the LLC picks, bags and labels them. A batch logged on/after Nov 1 counts baits (unit 'bait');
-- earlier batches stay in bags. Unbagged leftovers go back to JCB as reusable waste (credited on the PO).
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.production_batches
  add column if not exists unit        text    not null default 'bag',
  add column if not exists waste_baits integer not null default 0,
  add column if not exists waste_date  date,
  add column if not exists waste_by    text,
  add column if not exists waste_note  text    not null default '';

alter table public.production_batches drop constraint if exists production_batches_unit_check;
alter table public.production_batches add constraint production_batches_unit_check check (unit in ('bag','bait'));
alter table public.production_batches drop constraint if exists production_batches_waste_check;
alter table public.production_batches add constraint production_batches_waste_check check (waste_baits >= 0);
