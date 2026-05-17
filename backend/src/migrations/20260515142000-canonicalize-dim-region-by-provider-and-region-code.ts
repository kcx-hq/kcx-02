import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DO $$
BEGIN
  -- Normalize existing region codes to lowercase/trimmed form.
  IF to_regclass('public.dim_region') IS NOT NULL THEN
    UPDATE dim_region
    SET region_id = NULLIF(LOWER(BTRIM(region_id)), '')
    WHERE region_id IS NOT NULL;
  END IF;

  -- Remap fact/agg rows to canonical dim_region id for each provider_id + region_id.
  WITH canonical AS (
    SELECT provider_id, region_id, MIN(id) AS canonical_id
    FROM dim_region
    WHERE region_id IS NOT NULL
    GROUP BY provider_id, region_id
  ),
  remap AS (
    SELECT dr.id AS old_id, c.canonical_id
    FROM dim_region dr
    JOIN canonical c
      ON c.provider_id = dr.provider_id
     AND c.region_id = dr.region_id
    WHERE dr.id <> c.canonical_id
  )
  UPDATE fact_cost_line_items f
  SET region_key = r.canonical_id
  FROM remap r
  WHERE f.region_key = r.old_id;

  WITH canonical AS (
    SELECT provider_id, region_id, MIN(id) AS canonical_id
    FROM dim_region
    WHERE region_id IS NOT NULL
    GROUP BY provider_id, region_id
  ),
  remap AS (
    SELECT dr.id AS old_id, c.canonical_id
    FROM dim_region dr
    JOIN canonical c
      ON c.provider_id = dr.provider_id
     AND c.region_id = dr.region_id
    WHERE dr.id <> c.canonical_id
  )
  UPDATE agg_cost_hourly a
  SET region_key = r.canonical_id
  FROM remap r
  WHERE a.region_key = r.old_id;

  WITH canonical AS (
    SELECT provider_id, region_id, MIN(id) AS canonical_id
    FROM dim_region
    WHERE region_id IS NOT NULL
    GROUP BY provider_id, region_id
  ),
  remap AS (
    SELECT dr.id AS old_id, c.canonical_id
    FROM dim_region dr
    JOIN canonical c
      ON c.provider_id = dr.provider_id
     AND c.region_id = dr.region_id
    WHERE dr.id <> c.canonical_id
  )
  UPDATE agg_cost_daily a
  SET region_key = r.canonical_id
  FROM remap r
  WHERE a.region_key = r.old_id;

  WITH canonical AS (
    SELECT provider_id, region_id, MIN(id) AS canonical_id
    FROM dim_region
    WHERE region_id IS NOT NULL
    GROUP BY provider_id, region_id
  ),
  remap AS (
    SELECT dr.id AS old_id, c.canonical_id
    FROM dim_region dr
    JOIN canonical c
      ON c.provider_id = dr.provider_id
     AND c.region_id = dr.region_id
    WHERE dr.id <> c.canonical_id
  )
  UPDATE agg_cost_monthly a
  SET region_key = r.canonical_id
  FROM remap r
  WHERE a.region_key = r.old_id;

  -- Clear duplicate region_id on non-canonical rows so we can enforce uniqueness.
  WITH canonical AS (
    SELECT provider_id, region_id, MIN(id) AS canonical_id
    FROM dim_region
    WHERE region_id IS NOT NULL
    GROUP BY provider_id, region_id
  )
  UPDATE dim_region dr
  SET region_id = NULL
  FROM canonical c
  WHERE dr.provider_id = c.provider_id
    AND dr.region_id = c.region_id
    AND dr.id <> c.canonical_id;
END $$;
`);

    await queryInterface.sequelize.query(`
CREATE UNIQUE INDEX IF NOT EXISTS ux_dim_region_provider_region_code
  ON dim_region(provider_id, region_id)
  WHERE region_id IS NOT NULL;
`);
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS ux_dim_region_provider_region_code;
`);
  },
};

export default migration;

