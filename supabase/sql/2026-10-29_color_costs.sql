-- Material cost per gallon for each bait color, from the "JCB Color Formulas & Batch Calculator" Google Sheet.
-- One row per products.color. The finance app's shareholder report reads it for its Cost by Color section
-- (report only; COGS still uses the cost profiles). Colors with no row use the COGS sheet average.
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists public.color_costs (
  color      text primary key,          -- exactly as in products.color
  recipe     text not null,             -- color name on the calculator sheet ("A + B" = laminate, average of both)
  per_gal    numeric not null check (per_gal > 0),  -- material cost per gallon of plastisol
  as_of      date not null,
  updated_at timestamptz not null default now()
);

alter table public.color_costs enable row level security;
drop policy if exists "anon full access" on public.color_costs;
create policy "anon full access" on public.color_costs
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.color_costs to anon, authenticated;
