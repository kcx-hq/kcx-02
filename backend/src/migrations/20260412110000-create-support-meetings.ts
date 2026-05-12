/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { QueryInterface } from "sequelize";

const TABLE_NAME = "support_meetings";

async function tableExists(queryInterface: QueryInterface, tableName: string): Promise<boolean> {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function indexExists(queryInterface: QueryInterface, indexName: string): Promise<boolean> {
  const rows = await queryInterface.sequelize.query<{ exists: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = :indexName
) AS exists;
`,
    {
      replacements: { indexName },
      type: "SELECT",
    },
  );
  return Boolean(rows?.[0]?.exists);
}

async function addIndexIfMissing(
  queryInterface: QueryInterface,
  fields: string[],
  options: { name: string; unique?: boolean },
): Promise<void> {
  if (await indexExists(queryInterface, options.name)) return;
  await queryInterface.addIndex(TABLE_NAME, fields, options);
}

const migration = {
  async up(queryInterface: QueryInterface, Sequelize): Promise<void> {
    if (!(await tableExists(queryInterface, TABLE_NAME))) {
      await queryInterface.createTable(TABLE_NAME, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        tenant_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: "tenants",
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        requested_by: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        approved_by_admin_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "AdminUsers",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        meeting_code: {
          type: Sequelize.STRING(40),
          allowNull: false,
        },
        meeting_type: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        agenda: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        mode: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: "Google Meet",
        },
        status: {
          type: Sequelize.STRING(30),
          allowNull: false,
          defaultValue: "REQUESTED",
        },
        slot_start: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        slot_end: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        time_zone: {
          type: Sequelize.STRING(80),
          allowNull: false,
        },
        meeting_url: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        after_meeting_summary: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        approved_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
      });
    }

    await addIndexIfMissing(queryInterface, ["meeting_code"], {
      name: "uq_support_meetings_meeting_code",
      unique: true,
    });
    await addIndexIfMissing(queryInterface, ["tenant_id"], {
      name: "idx_support_meetings_tenant_id",
    });
    await addIndexIfMissing(queryInterface, ["requested_by"], {
      name: "idx_support_meetings_requested_by",
    });
    await addIndexIfMissing(queryInterface, ["status"], {
      name: "idx_support_meetings_status",
    });
    await addIndexIfMissing(queryInterface, ["slot_start"], {
      name: "idx_support_meetings_slot_start",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export default migration;

