/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { QueryInterface } from "sequelize";

const SUPPORT_TICKETS_TABLE = "support_tickets";
const SUPPORT_TICKET_MESSAGES_TABLE = "support_ticket_messages";

async function hasColumn(queryInterface: QueryInterface, tableName: string, columnName: string): Promise<boolean> {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table[columnName]);
  } catch {
    return false;
  }
}

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
  tableName: string,
  fields: string[],
  options: { name: string; unique?: boolean },
): Promise<void> {
  if (await indexExists(queryInterface, options.name)) return;
  await queryInterface.addIndex(tableName, fields, options);
}

const migration = {
  async up(queryInterface: QueryInterface, Sequelize): Promise<void> {
    if (!(await hasColumn(queryInterface, SUPPORT_TICKETS_TABLE, "progress"))) {
      await queryInterface.addColumn(SUPPORT_TICKETS_TABLE, "progress", {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "NEW",
      });
    }

    if (!(await hasColumn(queryInterface, SUPPORT_TICKETS_TABLE, "assigned_team"))) {
      await queryInterface.addColumn(SUPPORT_TICKETS_TABLE, "assigned_team", {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    if (!(await hasColumn(queryInterface, SUPPORT_TICKETS_TABLE, "client_responded_at"))) {
      await queryInterface.addColumn(SUPPORT_TICKETS_TABLE, "client_responded_at", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await addIndexIfMissing(queryInterface, SUPPORT_TICKETS_TABLE, ["progress"], {
      name: "idx_support_tickets_progress",
    });

    if (!(await tableExists(queryInterface, SUPPORT_TICKET_MESSAGES_TABLE))) {
      await queryInterface.createTable(SUPPORT_TICKET_MESSAGES_TABLE, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        ticket_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: SUPPORT_TICKETS_TABLE,
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        sender_type: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        sender_user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        sender_name: {
          type: Sequelize.STRING(150),
          allowNull: true,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
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

    await addIndexIfMissing(queryInterface, SUPPORT_TICKET_MESSAGES_TABLE, ["ticket_id"], {
      name: "idx_support_ticket_messages_ticket_id",
    });
    await addIndexIfMissing(queryInterface, SUPPORT_TICKET_MESSAGES_TABLE, ["created_at"], {
      name: "idx_support_ticket_messages_created_at",
    });
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable(SUPPORT_TICKET_MESSAGES_TABLE);
    await queryInterface.removeIndex(SUPPORT_TICKETS_TABLE, "idx_support_tickets_progress");
    await queryInterface.removeColumn(SUPPORT_TICKETS_TABLE, "client_responded_at");
    await queryInterface.removeColumn(SUPPORT_TICKETS_TABLE, "assigned_team");
    await queryInterface.removeColumn(SUPPORT_TICKETS_TABLE, "progress");
  },
};

export default migration;
