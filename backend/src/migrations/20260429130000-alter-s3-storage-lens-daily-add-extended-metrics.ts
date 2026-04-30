import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE s3_storage_lens_daily
  ADD COLUMN IF NOT EXISTS noncurrent_version_object_count NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS noncurrent_version_bytes NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS delete_marker_object_count NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS delete_marker_bytes NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS incomplete_multipart_upload_bytes NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS incomplete_multipart_upload_object_count NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS bytes_uploaded NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS bytes_downloaded NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS get_requests_count NUMERIC(30,0),
  ADD COLUMN IF NOT EXISTS put_requests_count NUMERIC(30,0);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
ALTER TABLE s3_storage_lens_daily
  DROP COLUMN IF EXISTS noncurrent_version_object_count,
  DROP COLUMN IF EXISTS noncurrent_version_bytes,
  DROP COLUMN IF EXISTS delete_marker_object_count,
  DROP COLUMN IF EXISTS delete_marker_bytes,
  DROP COLUMN IF EXISTS incomplete_multipart_upload_bytes,
  DROP COLUMN IF EXISTS incomplete_multipart_upload_object_count,
  DROP COLUMN IF EXISTS bytes_uploaded,
  DROP COLUMN IF EXISTS bytes_downloaded,
  DROP COLUMN IF EXISTS get_requests_count,
  DROP COLUMN IF EXISTS put_requests_count;
`);
  },
};

export default migration;

