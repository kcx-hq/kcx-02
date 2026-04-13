/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const TABLE_NAME = "support_tickets";

const migration = {
  async up(queryInterface, Sequelize) {
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

    await queryInterface.addIndex(TABLE_NAME, ["ticket_code"], {
      name: "uq_support_tickets_ticket_code",
      unique: true,
    });
    await queryInterface.addIndex(TABLE_NAME, ["tenant_id"], {
      name: "idx_support_tickets_tenant_id",
    });
    await queryInterface.addIndex(TABLE_NAME, ["status"], {
      name: "idx_support_tickets_status",
    });
    await queryInterface.addIndex(TABLE_NAME, ["created_by"], {
      name: "idx_support_tickets_created_by",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};

export default migration;
