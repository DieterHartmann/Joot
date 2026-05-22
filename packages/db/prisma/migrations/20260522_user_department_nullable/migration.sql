-- Make department_id nullable on the subsidiary user table.
-- The column was created NOT NULL when the schema was first pushed;
-- department assignment should be optional (users can be added without one
-- and assigned to a department later via the edit form).
ALTER TABLE "subsidiary"."user" ALTER COLUMN "department_id" DROP NOT NULL;
