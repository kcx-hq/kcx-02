/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
    async up(queryInterface) {
        await queryInterface.sequelize.query(`
DO $$
DECLARE
    r record;
BEGIN
    -- Drop single-column unique constraints that are too restrictive on FinOps dimensions.
    FOR r IN
        WITH target_cols(table_name, column_name) AS (
            VALUES
                ('dim_region', 'provider_id'),
                ('dim_region', 'region_id'),
                ('dim_region', 'region_name'),
                ('dim_region', 'availability_zone'),
                ('dim_service', 'provider_id'),
                ('dim_service', 'service_name'),
                ('dim_service', 'service_category'),
                ('dim_service', 'service_subcategory'),
                ('dim_sku', 'provider_id'),
                ('dim_sku', 'sku_id'),
                ('dim_sku', 'sku_price_id'),
                ('dim_sku', 'pricing_category'),
                ('dim_sku', 'pricing_unit'),
                ('dim_sub_account', 'tenant_id'),
                ('dim_sub_account', 'provider_id'),
                ('dim_sub_account', 'sub_account_id'),
                ('dim_resource', 'tenant_id'),
                ('dim_resource', 'provider_id'),
                ('dim_resource', 'resource_id'),
                ('dim_billing_account', 'tenant_id'),
                ('dim_billing_account', 'provider_id'),
                ('dim_billing_account', 'billing_account_id')
        )
        SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = con.conkey[1]
        JOIN target_cols t ON t.table_name = c.relname AND t.column_name = a.attname
        WHERE con.contype = 'u'
          AND cardinality(con.conkey) = 1
          AND n.nspname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            r.schema_name,
            r.table_name,
            r.constraint_name
        );
    END LOOP;

    -- Drop orphan single-column unique indexes that are not backing constraints.
    FOR r IN
        SELECT ns_idx.nspname AS schema_name, idx.relname AS index_name
        FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_namespace ns_idx ON ns_idx.oid = idx.relnamespace
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_namespace ns_tbl ON ns_tbl.oid = tbl.relnamespace
        LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
        WHERE ns_tbl.nspname = 'public'
          AND tbl.relname IN (
            'dim_region', 'dim_service', 'dim_sku',
            'dim_sub_account', 'dim_resource', 'dim_billing_account'
          )
          AND i.indisunique = true
          AND i.indisprimary = false
          AND i.indnkeyatts = 1
          AND con.oid IS NULL
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schema_name, r.index_name);
    END LOOP;

    -- Ensure expected composite unique constraints exist.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_region')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.dim_region'::regclass
              AND conname = 'uq_dim_region_provider_region_zone'
       ) THEN
        ALTER TABLE public.dim_region
        ADD CONSTRAINT uq_dim_region_provider_region_zone
        UNIQUE (provider_id, region_id, region_name, availability_zone);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_service')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.dim_service'::regclass
              AND conname = 'uq_dim_service_provider_name_category_subcategory'
       ) THEN
        ALTER TABLE public.dim_service
        ADD CONSTRAINT uq_dim_service_provider_name_category_subcategory
        UNIQUE (provider_id, service_name, service_category, service_subcategory);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_sku')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.dim_sku'::regclass
              AND conname = 'uq_dim_sku_provider_sku_price_category_unit'
       ) THEN
        ALTER TABLE public.dim_sku
        ADD CONSTRAINT uq_dim_sku_provider_sku_price_category_unit
        UNIQUE (provider_id, sku_id, sku_price_id, pricing_category, pricing_unit);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_sub_account')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.dim_sub_account'::regclass
              AND conname = 'uq_dim_sub_account_tenant_provider_sub_account_id'
       ) THEN
        ALTER TABLE public.dim_sub_account
        ADD CONSTRAINT uq_dim_sub_account_tenant_provider_sub_account_id
        UNIQUE (tenant_id, provider_id, sub_account_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_resource')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.dim_resource'::regclass
              AND conname = 'uq_dim_resource_tenant_provider_resource_id'
       ) THEN
        ALTER TABLE public.dim_resource
        ADD CONSTRAINT uq_dim_resource_tenant_provider_resource_id
        UNIQUE (tenant_id, provider_id, resource_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_billing_account')
       AND NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.dim_billing_account'::regclass
              AND conname = 'uq_dim_billing_account_tenant_provider_account_id'
       ) THEN
        ALTER TABLE public.dim_billing_account
        ADD CONSTRAINT uq_dim_billing_account_tenant_provider_account_id
        UNIQUE (tenant_id, provider_id, billing_account_id);
    END IF;
END $$;
`);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
DO $$
BEGIN
    -- Re-introduces previously removed single-column unique constraints.
    -- This can fail if current data includes duplicates, which is expected after the fix.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_region') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_region'::regclass AND conname = 'dim_region_provider_id_key') THEN
            ALTER TABLE public.dim_region ADD CONSTRAINT dim_region_provider_id_key UNIQUE (provider_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_region'::regclass AND conname = 'dim_region_region_id_key') THEN
            ALTER TABLE public.dim_region ADD CONSTRAINT dim_region_region_id_key UNIQUE (region_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_region'::regclass AND conname = 'dim_region_region_name_key') THEN
            ALTER TABLE public.dim_region ADD CONSTRAINT dim_region_region_name_key UNIQUE (region_name);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_region'::regclass AND conname = 'dim_region_availability_zone_key') THEN
            ALTER TABLE public.dim_region ADD CONSTRAINT dim_region_availability_zone_key UNIQUE (availability_zone);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_service') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_service'::regclass AND conname = 'dim_service_provider_id_key') THEN
            ALTER TABLE public.dim_service ADD CONSTRAINT dim_service_provider_id_key UNIQUE (provider_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_service'::regclass AND conname = 'dim_service_service_name_key') THEN
            ALTER TABLE public.dim_service ADD CONSTRAINT dim_service_service_name_key UNIQUE (service_name);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_service'::regclass AND conname = 'dim_service_service_category_key') THEN
            ALTER TABLE public.dim_service ADD CONSTRAINT dim_service_service_category_key UNIQUE (service_category);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_service'::regclass AND conname = 'dim_service_service_subcategory_key') THEN
            ALTER TABLE public.dim_service ADD CONSTRAINT dim_service_service_subcategory_key UNIQUE (service_subcategory);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_sku') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sku'::regclass AND conname = 'dim_sku_provider_id_key') THEN
            ALTER TABLE public.dim_sku ADD CONSTRAINT dim_sku_provider_id_key UNIQUE (provider_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sku'::regclass AND conname = 'dim_sku_sku_id_key') THEN
            ALTER TABLE public.dim_sku ADD CONSTRAINT dim_sku_sku_id_key UNIQUE (sku_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sku'::regclass AND conname = 'dim_sku_sku_price_id_key') THEN
            ALTER TABLE public.dim_sku ADD CONSTRAINT dim_sku_sku_price_id_key UNIQUE (sku_price_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sku'::regclass AND conname = 'dim_sku_pricing_category_key') THEN
            ALTER TABLE public.dim_sku ADD CONSTRAINT dim_sku_pricing_category_key UNIQUE (pricing_category);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sku'::regclass AND conname = 'dim_sku_pricing_unit_key') THEN
            ALTER TABLE public.dim_sku ADD CONSTRAINT dim_sku_pricing_unit_key UNIQUE (pricing_unit);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_sub_account') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sub_account'::regclass AND conname = 'dim_sub_account_tenant_id_key') THEN
            ALTER TABLE public.dim_sub_account ADD CONSTRAINT dim_sub_account_tenant_id_key UNIQUE (tenant_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sub_account'::regclass AND conname = 'dim_sub_account_provider_id_key') THEN
            ALTER TABLE public.dim_sub_account ADD CONSTRAINT dim_sub_account_provider_id_key UNIQUE (provider_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_sub_account'::regclass AND conname = 'dim_sub_account_sub_account_id_key') THEN
            ALTER TABLE public.dim_sub_account ADD CONSTRAINT dim_sub_account_sub_account_id_key UNIQUE (sub_account_id);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_resource') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_resource'::regclass AND conname = 'dim_resource_tenant_id_key') THEN
            ALTER TABLE public.dim_resource ADD CONSTRAINT dim_resource_tenant_id_key UNIQUE (tenant_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_resource'::regclass AND conname = 'dim_resource_provider_id_key') THEN
            ALTER TABLE public.dim_resource ADD CONSTRAINT dim_resource_provider_id_key UNIQUE (provider_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_resource'::regclass AND conname = 'dim_resource_resource_id_key') THEN
            ALTER TABLE public.dim_resource ADD CONSTRAINT dim_resource_resource_id_key UNIQUE (resource_id);
        END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dim_billing_account') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_billing_account'::regclass AND conname = 'dim_billing_account_tenant_id_key') THEN
            ALTER TABLE public.dim_billing_account ADD CONSTRAINT dim_billing_account_tenant_id_key UNIQUE (tenant_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_billing_account'::regclass AND conname = 'dim_billing_account_provider_id_key') THEN
            ALTER TABLE public.dim_billing_account ADD CONSTRAINT dim_billing_account_provider_id_key UNIQUE (provider_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dim_billing_account'::regclass AND conname = 'dim_billing_account_billing_account_id_key') THEN
            ALTER TABLE public.dim_billing_account ADD CONSTRAINT dim_billing_account_billing_account_id_key UNIQUE (billing_account_id);
        END IF;
    END IF;
END $$;
`);
    },
};

export default migration;



