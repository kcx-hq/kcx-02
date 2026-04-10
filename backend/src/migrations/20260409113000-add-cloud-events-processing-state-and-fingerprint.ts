/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
ALTER TABLE "cloud_events"
  ADD COLUMN IF NOT EXISTS "processing_status" varchar(20),
  ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "processing_error" text,
  ADD COLUMN IF NOT EXISTS "event_fingerprint" varchar(128);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_cloud_events_processing_status'
  ) THEN
    ALTER TABLE "cloud_events"
      ADD CONSTRAINT "chk_cloud_events_processing_status"
      CHECK (
        "processing_status" IS NULL OR
        "processing_status" IN ('pending', 'processing', 'processed', 'failed')
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_cloud_events_event_fingerprint"
  ON "cloud_events" ("event_fingerprint")
  WHERE "event_fingerprint" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_cloud_events_file_processing_status"
  ON "cloud_events" ("processing_status", "event_time")
  WHERE "event_name" = 'cloudtrail_object_created'
    AND "event_category" = 'cloudtrail_file_event';

UPDATE "cloud_events"
SET "processing_status" = 'pending'
WHERE "event_name" = 'cloudtrail_object_created'
  AND "event_category" = 'cloudtrail_file_event'
  AND "processing_status" IS NULL;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS "idx_cloud_events_file_processing_status";
DROP INDEX IF EXISTS "uq_cloud_events_event_fingerprint";

ALTER TABLE "cloud_events"
  DROP CONSTRAINT IF EXISTS "chk_cloud_events_processing_status",
  DROP COLUMN IF EXISTS "event_fingerprint",
  DROP COLUMN IF EXISTS "processing_error",
  DROP COLUMN IF EXISTS "processed_at",
  DROP COLUMN IF EXISTS "processing_status";
`);
  },
};

export default migration;
