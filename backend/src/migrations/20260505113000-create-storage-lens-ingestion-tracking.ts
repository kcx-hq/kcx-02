import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
CREATE TABLE IF NOT EXISTS storage_lens_ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  billing_source_id BIGINT NOT NULL REFERENCES billing_sources(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  current_step VARCHAR(100),
  progress_percent INTEGER NOT NULL DEFAULT 0,
  status_message TEXT,
  files_discovered INTEGER NOT NULL DEFAULT 0,
  files_processed INTEGER NOT NULL DEFAULT 0,
  rows_read INTEGER NOT NULL DEFAULT 0,
  rows_loaded INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  total_rows_estimated INTEGER,
  error_message TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_storage_lens_ingestion_runs_source_created
  ON storage_lens_ingestion_runs(billing_source_id, created_at DESC);

CREATE TABLE IF NOT EXISTS storage_lens_raw_files (
  id BIGSERIAL PRIMARY KEY,
  billing_source_id BIGINT NOT NULL REFERENCES billing_sources(id) ON DELETE CASCADE,
  ingestion_run_id BIGINT REFERENCES storage_lens_ingestion_runs(id) ON DELETE SET NULL,
  tenant_id VARCHAR(100) NOT NULL,
  cloud_provider_id BIGINT NOT NULL REFERENCES cloud_providers(id),
  cloud_connection_id UUID REFERENCES cloud_connections_v2(id) ON DELETE SET NULL,
  storage_bucket VARCHAR(255) NOT NULL,
  storage_key VARCHAR(1000) NOT NULL,
  file_format VARCHAR(20) NOT NULL,
  file_size_bytes BIGINT,
  etag VARCHAR(255),
  last_modified_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'discovered',
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_storage_lens_raw_files_source_bucket_key
  ON storage_lens_raw_files(billing_source_id, storage_bucket, storage_key);

CREATE INDEX IF NOT EXISTS idx_storage_lens_raw_files_run
  ON storage_lens_raw_files(ingestion_run_id);
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP TABLE IF EXISTS storage_lens_raw_files;
DROP TABLE IF EXISTS storage_lens_ingestion_runs;
`);
  },
};

export default migration;

