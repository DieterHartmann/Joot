-- Make ctc nullable on the subsidiary user table.
-- CTC is optional — not all subsidiaries track salary in this system.
ALTER TABLE "subsidiary"."user" ALTER COLUMN "ctc" DROP NOT NULL;
