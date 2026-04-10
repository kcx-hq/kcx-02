/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', { transaction });

      // 1) Backfill cloud_connection_id from billing_sources via billing_source_id.
      await queryInterface.sequelize.query(
        `
          UPDATE "fact_anomalies" fa
          SET "cloud_connection_id" = bs."cloud_connection_id"
          FROM "billing_sources" bs
          WHERE fa."billing_source_id" = bs."id"
            AND fa."cloud_connection_id" IS NULL
            AND bs."cloud_connection_id" IS NOT NULL;
        `,
        { transaction },
      );

      // 2) Make cloud_connection_id nullable.
      await queryInterface.changeColumn(
        "fact_anomalies",
        "cloud_connection_id",
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "cloud_connections", key: "id" },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        { transaction },
      );

      // Guard before 3) make billing_source_id NOT NULL.
      const [nullBillingSourceRows] = await queryInterface.sequelize.query(
        `
          SELECT COUNT(*)::bigint AS count
          FROM "fact_anomalies"
          WHERE "billing_source_id" IS NULL;
        `,
        { transaction },
      );

      const nullBillingSourceCount = Number(nullBillingSourceRows?.[0]?.count ?? 0);
      if (nullBillingSourceCount > 0) {
        throw new Error(
          `Cannot enforce fact_anomalies.billing_source_id NOT NULL: found ${nullBillingSourceCount} row(s) with NULL billing_source_id. ` +
            `Backfill or remove those rows first, then rerun migration.`,
        );
      }

      // 3) Make billing_source_id required.
      await queryInterface.changeColumn(
        "fact_anomalies",
        "billing_source_id",
        {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: "billing_sources", key: "id" },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        { transaction },
      );

      // Add anomaly_detection_runs table.
      await queryInterface.createTable(
        "anomaly_detection_runs",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
          },
          tenant_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "tenants", key: "id" },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          },
          billing_source_id: {
            type: Sequelize.BIGINT,
            allowNull: true,
            references: { model: "billing_sources", key: "id" },
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
          },
          cloud_connection_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "cloud_connections", key: "id" },
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
          },
          ingestion_run_id: {
            type: Sequelize.BIGINT,
            allowNull: true,
            references: { model: "billing_ingestion_runs", key: "id" },
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
          },
          trigger_type: { type: Sequelize.STRING(30), allowNull: false },
          mode: { type: Sequelize.STRING(30), allowNull: false },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "queued" },
          date_from: { type: Sequelize.DATEONLY, allowNull: true },
          date_to: { type: Sequelize.DATEONLY, allowNull: true },
          include_hourly: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          force_rebuild: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          sources_processed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          anomalies_created: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          anomalies_updated: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          anomalies_resolved: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          error_message: { type: Sequelize.TEXT, allowNull: true },
          status_message: { type: Sequelize.TEXT, allowNull: true },
          started_at: { type: Sequelize.DATE, allowNull: true },
          finished_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
          created_by: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: "users", key: "id" },
            onDelete: "SET NULL",
            onUpdate: "CASCADE",
          },
          metadata_json: { type: Sequelize.JSONB, allowNull: true },
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE "anomaly_detection_runs"
          ADD CONSTRAINT "chk_anomaly_detection_runs_trigger_type"
          CHECK ("trigger_type" IN ('ingestion', 'manual', 'system'));
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE "anomaly_detection_runs"
          ADD CONSTRAINT "chk_anomaly_detection_runs_mode"
          CHECK ("mode" IN ('incremental', 'date_range', 'full'));
        `,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          ALTER TABLE "anomaly_detection_runs"
          ADD CONSTRAINT "chk_anomaly_detection_runs_status"
          CHECK ("status" IN ('queued', 'running', 'completed', 'failed', 'cancelled'));
        `,
        { transaction },
      );

      await queryInterface.addIndex("anomaly_detection_runs", ["tenant_id"], {
        name: "idx_anomaly_detection_runs_tenant_id",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["billing_source_id"], {
        name: "idx_anomaly_detection_runs_billing_source_id",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["cloud_connection_id"], {
        name: "idx_anomaly_detection_runs_cloud_connection_id",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["ingestion_run_id"], {
        name: "idx_anomaly_detection_runs_ingestion_run_id",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["status"], {
        name: "idx_anomaly_detection_runs_status",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["trigger_type", "mode"], {
        name: "idx_anomaly_detection_runs_trigger_mode",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["created_at"], {
        name: "idx_anomaly_detection_runs_created_at",
        transaction,
      });
      await queryInterface.addIndex("anomaly_detection_runs", ["billing_source_id", "status", "created_at"], {
        name: "idx_anomaly_detection_runs_source_status_created_at",
        transaction,
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("anomaly_detection_runs", { transaction });

      await queryInterface.changeColumn(
        "fact_anomalies",
        "billing_source_id",
        {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: "billing_sources", key: "id" },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE "fact_anomalies" fa
          SET "cloud_connection_id" = bs."cloud_connection_id"
          FROM "billing_sources" bs
          WHERE fa."billing_source_id" = bs."id"
            AND fa."cloud_connection_id" IS NULL
            AND bs."cloud_connection_id" IS NOT NULL;
        `,
        { transaction },
      );

      const [nullCloudConnectionRows] = await queryInterface.sequelize.query(
        `
          SELECT COUNT(*)::bigint AS count
          FROM "fact_anomalies"
          WHERE "cloud_connection_id" IS NULL;
        `,
        { transaction },
      );

      const nullCloudConnectionCount = Number(nullCloudConnectionRows?.[0]?.count ?? 0);
      if (nullCloudConnectionCount > 0) {
        throw new Error(
          `Cannot revert fact_anomalies.cloud_connection_id to NOT NULL: found ${nullCloudConnectionCount} row(s) with NULL cloud_connection_id.`,
        );
      }

      await queryInterface.changeColumn(
        "fact_anomalies",
        "cloud_connection_id",
        {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "cloud_connections", key: "id" },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        { transaction },
      );
    });
  },
};

export default migration;
