/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { QueryInterface } from "sequelize";

const TABLE_NAME = "support_tickets";

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
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        ticket_code: {
          type: Sequelize.STRING(40),
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        issue_category: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        priority: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "Medium",
        },
        affected: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        attachments: {
          type: Sequelize.ARRAY(Sequelize.TEXT),
          allowNull: false,
          defaultValue: [],
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "Under Review",
        },
        workflow_stage: {
          type: Sequelize.STRING(80),
          allowNull: false,
          defaultValue: "Submitted to KCX",
        },
        sla_deadline_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        last_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("NOW()"),
        },
        closed_at: {
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

    await addIndexIfMissing(queryInterface, ["ticket_code"], {
      name: "uq_support_tickets_ticket_code",
      unique: true,
    });
    await addIndexIfMissing(queryInterface, ["tenant_id"], {
      name: "idx_support_tickets_tenant_id",
    });
    await addIndexIfMissing(queryInterface, ["status"], {
      name: "idx_support_tickets_status",
    });
    await addIndexIfMissing(queryInterface, ["created_by"], {
      name: "idx_support_tickets_created_by",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export default migration;
