/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  -- dim_region: dedupe by normalized business key (NULLs treated as empty strings)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_region') THEN
    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, COALESCE(region_id, ''), region_name, COALESCE(availability_zone, '')
        ) AS keep_id
      FROM dim_region
    ),
    dupes AS (
      SELECT id AS old_id, keep_id
      FROM ranked
      WHERE id <> keep_id
    )
    UPDATE fact_cost_line_items f
    SET region_key = d.keep_id
    FROM dupes d
    WHERE f.region_key = d.old_id;

    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, COALESCE(region_id, ''), region_name, COALESCE(availability_zone, '')
        ) AS keep_id
      FROM dim_region
    ),
    dupes AS (
      SELECT id AS old_id, keep_id
      FROM ranked
      WHERE id <> keep_id
    )
    UPDATE fact_anomalies f
    SET region_key = d.keep_id
    FROM dupes d
    WHERE f.region_key = d.old_id;

    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, COALESCE(region_id, ''), region_name, COALESCE(availability_zone, '')
        ) AS keep_id
      FROM dim_region
    )
    DELETE FROM dim_region d
    USING ranked r
    WHERE d.id = r.id
      AND r.id <> r.keep_id;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_dim_region_provider_region_zone_norm
      ON dim_region (provider_id, COALESCE(region_id, ''), region_name, COALESCE(availability_zone, ''));
  END IF;

  -- dim_service: dedupe by normalized business key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_service') THEN
    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, service_name, COALESCE(service_category, ''), COALESCE(service_subcategory, '')
        ) AS keep_id
      FROM dim_service
    ),
    dupes AS (
      SELECT id AS old_id, keep_id
      FROM ranked
      WHERE id <> keep_id
    )
    UPDATE fact_cost_line_items f
    SET service_key = d.keep_id
    FROM dupes d
    WHERE f.service_key = d.old_id;

    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, service_name, COALESCE(service_category, ''), COALESCE(service_subcategory, '')
        ) AS keep_id
      FROM dim_service
    ),
    dupes AS (
      SELECT id AS old_id, keep_id
      FROM ranked
      WHERE id <> keep_id
    )
    UPDATE fact_anomalies f
    SET service_key = d.keep_id
    FROM dupes d
    WHERE f.service_key = d.old_id;

    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, service_name, COALESCE(service_category, ''), COALESCE(service_subcategory, '')
        ) AS keep_id
      FROM dim_service
    )
    DELETE FROM dim_service d
    USING ranked r
    WHERE d.id = r.id
      AND r.id <> r.keep_id;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_dim_service_provider_name_category_subcategory_norm
      ON dim_service (provider_id, service_name, COALESCE(service_category, ''), COALESCE(service_subcategory, ''));
  END IF;

  -- dim_sku: dedupe by normalized business key
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_sku') THEN
    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, COALESCE(sku_id, ''), COALESCE(sku_price_id, ''), COALESCE(pricing_category, ''), COALESCE(pricing_unit, '')
        ) AS keep_id
      FROM dim_sku
    ),
    dupes AS (
      SELECT id AS old_id, keep_id
      FROM ranked
      WHERE id <> keep_id
    )
    UPDATE fact_cost_line_items f
    SET sku_key = d.keep_id
    FROM dupes d
    WHERE f.sku_key = d.old_id;

    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY provider_id, COALESCE(sku_id, ''), COALESCE(sku_price_id, ''), COALESCE(pricing_category, ''), COALESCE(pricing_unit, '')
        ) AS keep_id
      FROM dim_sku
    )
    DELETE FROM dim_sku d
    USING ranked r
    WHERE d.id = r.id
      AND r.id <> r.keep_id;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_dim_sku_provider_sku_price_category_unit_norm
      ON dim_sku (provider_id, COALESCE(sku_id, ''), COALESCE(sku_price_id, ''), COALESCE(pricing_category, ''), COALESCE(pricing_unit, ''));
  END IF;

  -- dim_charge: had no uniqueness guard before; enforce now
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_charge') THEN
    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY COALESCE(charge_category, ''), COALESCE(charge_class, '')
        ) AS keep_id
      FROM dim_charge
    ),
    dupes AS (
      SELECT id AS old_id, keep_id
      FROM ranked
      WHERE id <> keep_id
    )
    UPDATE fact_cost_line_items f
    SET charge_key = d.keep_id
    FROM dupes d
    WHERE f.charge_key = d.old_id;

    WITH ranked AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY COALESCE(charge_category, ''), COALESCE(charge_class, '')
        ) AS keep_id
      FROM dim_charge
    )
    DELETE FROM dim_charge d
    USING ranked r
    WHERE d.id = r.id
      AND r.id <> r.keep_id;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_dim_charge_category_class_norm
      ON dim_charge (COALESCE(charge_category, ''), COALESCE(charge_class, ''));
  END IF;
END $$;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS uq_dim_region_provider_region_zone_norm;
DROP INDEX IF EXISTS uq_dim_service_provider_name_category_subcategory_norm;
DROP INDEX IF EXISTS uq_dim_sku_provider_sku_price_category_unit_norm;
DROP INDEX IF EXISTS uq_dim_charge_category_class_norm;
`);
  },
};

export default migration;

