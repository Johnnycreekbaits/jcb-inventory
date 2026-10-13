-- Federal excise tax: 10% of the first sale (JCB Manufacturing -> Johnny Creek Baits, LLC).
-- cost_profiles.first_sale = that transfer price per unit. cogs = production cost WITHOUT excise
-- (JCB BOMs sheet: 8 baits x $0.0586 + $0.20 average bag = $0.67). Run once in the Supabase SQL editor.

alter table cost_profiles add column if not exists first_sale numeric;

update cost_profiles set cogs = 0.67, first_sale = 1.10
 where id in ('baby-hawg','craw','finesse-worm','neko','stickbait','soft-jerk','terp-minnow','paddle-tail');

update cost_profiles set cogs = 4.69, first_sale = 7.70 where id = 'variety-pack';

select id, name, unit, cogs, first_sale from cost_profiles order by id;
