-- Returns tab: every return (from an order or not) with reason, who, and whether it was restocked.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.

create table if not exists public.returns (
  id          bigint primary key,
  return_date date not null,
  log_id      bigint,                        -- order returned against (null = no order)
  order_name  text not null default '',
  person      text not null default '',
  channel     text not null default '',
  items       jsonb not null default '[]'::jsonb,  -- [{pid,name,color,qty,price,components?}]
  reason      text not null default '',
  note        text not null default '',
  restocked   boolean not null default true,
  returned_by text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists returns_log_id_idx on public.returns (log_id);

alter table public.history add column if not exists return_id bigint;

alter table public.returns enable row level security;
drop policy if exists "anon full access" on public.returns;
create policy "anon full access" on public.returns
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.returns to anon, authenticated;
