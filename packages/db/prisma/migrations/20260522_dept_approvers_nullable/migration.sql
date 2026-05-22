-- default_approver_id and apex_approver_id are optional on departments.
-- Departments are created without approvers and wired up after employees exist.
ALTER TABLE "subsidiary"."department" ALTER COLUMN "default_approver_id" DROP NOT NULL;
ALTER TABLE "subsidiary"."department" ALTER COLUMN "apex_approver_id"    DROP NOT NULL;
