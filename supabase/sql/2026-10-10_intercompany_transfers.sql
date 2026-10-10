-- Intercompany transfers: JCB Manufacturing (vendor) -> Johnny Creek Baits, LLC (buyer)
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- ids are client-generated bigints (Date.now()-style), like logs/history/expenses.

create table if not exists public.production_batches (
  id           bigint primary key,
  batch_date   date not null,
  product_id   bigint not null,
  product_name text not null default '',
  color        text not null default '',
  qty          integer not null check (qty > 0),
  batch_no     text not null default '',
  made_by      text not null default '',
  note         text not null default '',
  entered_by   text not null default '',
  edited_by    text,
  edited_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists production_batches_date_idx on public.production_batches (batch_date);

create table if not exists public.transfer_pos (
  id             bigint primary key,
  po_number      text not null default '',
  po_date        date,
  period_start   date,
  period_end     date,
  status         text not null default 'Draft' check (status in ('Draft','Issued','Received','Paid')),
  markup_pct     numeric(6,2) not null default 15,
  vendor_name    text not null default 'JCB Manufacturing',
  vendor_address text not null default '',
  buyer_name     text not null default 'Johnny Creek Baits, LLC',
  buyer_address  text not null default '',
  terms          text not null default 'Net 30',
  notes          text not null default '',
  lines          jsonb not null default '[]'::jsonb,
  total          numeric(12,2) not null default 0,
  paid_date      date,
  created_by     text not null default '',
  updated_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.history add column if not exists batch_id bigint;
create index if not exists history_batch_id_idx on public.history (batch_id);

-- RLS: same open access the app's anon key has on the existing tables
alter table public.production_batches enable row level security;
alter table public.transfer_pos       enable row level security;

drop policy if exists "anon full access" on public.production_batches;
create policy "anon full access" on public.production_batches
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.transfer_pos;
create policy "anon full access" on public.transfer_pos
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.production_batches, public.transfer_pos to anon, authenticated;
