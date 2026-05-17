-- Add country_code to subsidiary (public schema)
ALTER TABLE "public"."subsidiary"
  ADD COLUMN IF NOT EXISTS "country_code" TEXT NOT NULL DEFAULT 'ZA';

-- Add source, country_code, and unique constraint to public_holiday_calendar (subsidiary schema)
ALTER TABLE "subsidiary"."public_holiday_calendar"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE "subsidiary"."public_holiday_calendar"
  ADD COLUMN IF NOT EXISTS "country_code" TEXT NOT NULL DEFAULT 'ZA';

ALTER TABLE "subsidiary"."public_holiday_calendar"
  DROP CONSTRAINT IF EXISTS public_holiday_calendar_subsidiary_id_date_key;

ALTER TABLE "subsidiary"."public_holiday_calendar"
  ADD CONSTRAINT public_holiday_calendar_subsidiary_id_date_key
  UNIQUE (subsidiary_id, holiday_date);
