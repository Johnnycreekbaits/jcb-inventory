-- Follow-up to 2026-10-22_expense_entity.sql: the accountant's P&Ls through Oct 2026 covered BOTH companies.
-- 'both' = from a combined P&L (counted in the finance app's Combined view only). Separate P&Ls from now on.
alter table expenses alter column entity set default 'both';
alter table expenses drop constraint if exists expenses_entity_check;
alter table expenses add constraint expenses_entity_check check (entity in ('llc','mfg','both'));
update expenses set entity = 'both';
