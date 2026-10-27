-- Greg's device was signed in as "Team Member 2". The apps already show those rows as Greg
-- (NAME_ALIAS in index.html + profit.html); this makes it permanent in the data.
-- Run in the Supabase SQL editor. Safe to run more than once.
update production_batches set made_by    = 'Greg' where made_by    = 'Team Member 2';
update production_batches set entered_by = 'Greg' where entered_by = 'Team Member 2';
update production_batches set edited_by  = 'Greg' where edited_by  = 'Team Member 2';
update production_batches set waste_by   = 'Greg' where waste_by   = 'Team Member 2';
update history            set changed_by = 'Greg' where changed_by = 'Team Member 2';
update returns            set returned_by= 'Greg' where returned_by= 'Team Member 2';
