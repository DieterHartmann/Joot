/*
  Warnings:

  - The primary key for the `ba_account` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ba_session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ba_user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ba_verification` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "ba_account" DROP CONSTRAINT "ba_account_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ba_session" DROP CONSTRAINT "ba_session_user_id_fkey";

-- AlterTable
ALTER TABLE "ba_account" DROP CONSTRAINT "ba_account_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ba_account_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ba_session" DROP CONSTRAINT "ba_session_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ba_session_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ba_user" DROP CONSTRAINT "ba_user_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ba_user_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ba_verification" DROP CONSTRAINT "ba_verification_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ba_verification_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "ba_session" ADD CONSTRAINT "ba_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ba_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ba_account" ADD CONSTRAINT "ba_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "ba_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
