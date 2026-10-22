-- Each expense belongs to one company: 'llc' = Johnny Creek Baits, LLC, 'mfg' = JCB Manufacturing.
-- Existing rows become 'llc'; retag them on the finance app's Expenses tab.
alter table expenses add column if not exists entity text not null default 'llc';
alter table expenses drop constraint if exists expenses_entity_check;
alter table expenses add constraint expenses_entity_check check (entity in ('llc','mfg'));
