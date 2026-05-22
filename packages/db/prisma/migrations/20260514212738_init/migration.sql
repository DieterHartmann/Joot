-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "subsidiary";

-- CreateEnum
CREATE TYPE "LeaveYearType" AS ENUM ('calendar', 'tax', 'anniversary');

-- CreateEnum
CREATE TYPE "subsidiary"."Role" AS ENUM ('employee', 'manager', 'hr_director', 'ceo', 'subsidiary_admin', 'holding_admin');

-- CreateEnum
CREATE TYPE "subsidiary"."LeaveCategory" AS ENUM ('annual', 'sick', 'parental', 'maternity', 'compassionate', 'family_responsibility', 'custom');

-- CreateEnum
CREATE TYPE "subsidiary"."RuleType" AS ENUM ('accrual_rate', 'probation_block', 'max_consecutive_days', 'min_notice_days', 'expiry_warning_days', 'sick_leave_cycle', 'bcea_floor');

-- CreateEnum
CREATE TYPE "subsidiary"."LeaveRequestStatus" AS ENUM ('draft', 'pending_line_manager', 'pending_apex', 'approved', 'rejected', 'cancelled', 'recalled');

-- CreateEnum
CREATE TYPE "subsidiary"."HalfDayPortion" AS ENUM ('morning', 'afternoon');

-- CreateEnum
CREATE TYPE "subsidiary"."ApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected', 'delegated');

-- CreateTable
CREATE TABLE "holding_company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "schema_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holding_company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary" (
    "id" UUID NOT NULL,
    "holding_company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pg_schema" TEXT NOT NULL,
    "leave_year_type" "LeaveYearType" NOT NULL,
    "leave_year_start" DATE,
    "public_holidays_excluded" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subsidiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."user" (
    "id" UUID NOT NULL,
    "subsidiary_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "subsidiary"."Role" NOT NULL,
    "start_date" DATE NOT NULL,
    "ctc" DECIMAL(15,2) NOT NULL,
    "ms_entra_linked" BOOLEAN NOT NULL DEFAULT false,
    "entra_object_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."department" (
    "id" UUID NOT NULL,
    "subsidiary_id" UUID NOT NULL,
    "parent_department_id" UUID,
    "name" TEXT NOT NULL,
    "default_approver_id" UUID NOT NULL,
    "apex_approver_id" UUID,
    "tree_depth" INTEGER NOT NULL DEFAULT 0,
    "tree_path" TEXT NOT NULL,
    "tree_path_label" TEXT NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."leave_type" (
    "id" UUID NOT NULL,
    "subsidiary_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "subsidiary"."LeaveCategory" NOT NULL,
    "max_days_per_year" INTEGER,
    "allow_negative" BOOLEAN NOT NULL DEFAULT false,
    "expiry_months" INTEGER,
    "requires_dual_approval" BOOLEAN NOT NULL DEFAULT false,
    "bcea_protected" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "leave_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."leave_rule" (
    "id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "rule_type" "subsidiary"."RuleType" NOT NULL,
    "parameters" JSONB NOT NULL,

    CONSTRAINT "leave_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."leave_balance" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "accrued" DECIMAL(10,2) NOT NULL,
    "used" DECIMAL(10,2) NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "accrual_rate" DECIMAL(5,2) NOT NULL,
    "last_accrual_date" DATE NOT NULL,
    "expiry_date" DATE,

    CONSTRAINT "leave_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."leave_request" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_calculated" DECIMAL(5,2) NOT NULL,
    "includes_half_day" BOOLEAN NOT NULL DEFAULT false,
    "half_day_portion" "subsidiary"."HalfDayPortion",
    "status" "subsidiary"."LeaveRequestStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "is_backdated" BOOLEAN NOT NULL DEFAULT false,
    "backdated_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."approval_step" (
    "id" UUID NOT NULL,
    "leave_request_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "subsidiary"."ApprovalStepStatus" NOT NULL DEFAULT 'pending',
    "decision_notes" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "approval_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."deputy_assignment" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "deputy_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "is_permanent" BOOLEAN NOT NULL DEFAULT false,
    "is_temporary_override" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "deputy_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."audit_event" (
    "id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subsidiary"."public_holiday_calendar" (
    "id" UUID NOT NULL,
    "subsidiary_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "holiday_date" DATE NOT NULL,
    "description" TEXT,

    CONSTRAINT "public_holiday_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "subsidiary"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balance_user_id_leave_type_id_key" ON "subsidiary"."leave_balance"("user_id", "leave_type_id");

-- AddForeignKey
ALTER TABLE "subsidiary" ADD CONSTRAINT "subsidiary_holding_company_id_fkey" FOREIGN KEY ("holding_company_id") REFERENCES "holding_company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."user" ADD CONSTRAINT "user_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "subsidiary"."department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."department" ADD CONSTRAINT "department_parent_department_id_fkey" FOREIGN KEY ("parent_department_id") REFERENCES "subsidiary"."department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."department" ADD CONSTRAINT "department_default_approver_id_fkey" FOREIGN KEY ("default_approver_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."department" ADD CONSTRAINT "department_apex_approver_id_fkey" FOREIGN KEY ("apex_approver_id") REFERENCES "subsidiary"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."leave_rule" ADD CONSTRAINT "leave_rule_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "subsidiary"."leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."leave_balance" ADD CONSTRAINT "leave_balance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."leave_balance" ADD CONSTRAINT "leave_balance_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "subsidiary"."leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."leave_request" ADD CONSTRAINT "leave_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."leave_request" ADD CONSTRAINT "leave_request_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "subsidiary"."leave_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."approval_step" ADD CONSTRAINT "approval_step_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "subsidiary"."leave_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."approval_step" ADD CONSTRAINT "approval_step_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."deputy_assignment" ADD CONSTRAINT "deputy_assignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."deputy_assignment" ADD CONSTRAINT "deputy_assignment_deputy_id_fkey" FOREIGN KEY ("deputy_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary"."audit_event" ADD CONSTRAINT "audit_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "subsidiary"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
