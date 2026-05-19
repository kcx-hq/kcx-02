import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE s3_cost_daily
    ALTER COLUMN storage_class DROP NOT NULL;
  `);

  await queryInterface.sequelize.query(`
    UPDATE s3_cost_daily
    SET storage_class = CASE
      WHEN cost_category <> 'Storage' THEN NULL

      WHEN lower(
        COALESCE(usage_type, '')
        || ' '
        || COALESCE(operation, '')
        || ' '
        || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
      ) LIKE '%deeparchive%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%deep archive%'
      THEN 'Deep Archive'

      WHEN lower(
        COALESCE(usage_type, '')
        || ' '
        || COALESCE(operation, '')
        || ' '
        || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
      ) LIKE '%intelligenttiering%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%intelligent-tiering%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%intelligent tiering%'
      THEN 'Intelligent Tiering'

      WHEN lower(
        COALESCE(usage_type, '')
        || ' '
        || COALESCE(operation, '')
        || ' '
        || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
      ) LIKE '%onezoneia%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%one zone%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%onezone%'
      THEN 'One Zone-IA'

      WHEN lower(
        COALESCE(usage_type, '')
        || ' '
        || COALESCE(operation, '')
        || ' '
        || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
      ) LIKE '%standardia%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%standard-ia%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%standard infrequent access%'
      THEN 'Standard-IA'

      WHEN lower(
        COALESCE(usage_type, '')
        || ' '
        || COALESCE(operation, '')
        || ' '
        || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
      ) LIKE '%glacier%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%archive%'
      THEN 'Glacier'

      WHEN lower(
        COALESCE(usage_type, '')
        || ' '
        || COALESCE(operation, '')
        || ' '
        || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
      ) LIKE '%standardstorage%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%standard storage%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%timedstorage-bytehrs%'
        OR lower(
          COALESCE(usage_type, '')
          || ' '
          || COALESCE(operation, '')
          || ' '
          || COALESCE((to_jsonb(s3_cost_daily)->>'product_usage_type'), '')
        ) LIKE '%bytehrs%'
      THEN 'S3 Standard'

      ELSE NULL
    END;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    UPDATE s3_cost_daily
    SET storage_class = COALESCE(storage_class, 'Unknown');
  `);

  await queryInterface.sequelize.query(`
    ALTER TABLE s3_cost_daily
    ALTER COLUMN storage_class SET NOT NULL;
  `);
}

