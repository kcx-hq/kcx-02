/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    if (await hasTable(queryInterface, "budget_alerts")) {
      return;
    }

    await queryInterface.createTable("budget_alerts", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      budget_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "budgets", key: "id" },
        onDelete: "CASCADE",
      },
      threshold_percent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      alert_type: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      notification_type: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addConstraint("budget_alerts", {
      type: "check",
      fields: ["alert_type"],
      where: {
        [Sequelize.Op.or]: [{ alert_type: null }, { alert_type: ["actual", "forecast"] }],
      },
      name: "chk_budget_alerts_alert_type",
    });

    await queryInterface.addConstraint("budget_alerts", {
      type: "check",
      fields: ["notification_type"],
      where: {
        [Sequelize.Op.or]: [
          { notification_type: null },
          { notification_type: ["email", "slack", "webhook"] },
        ],
      },
      name: "chk_budget_alerts_notification_type",
    });

    await queryInterface.addIndex("budget_alerts", ["budget_id"], {
      name: "idx_budget_alerts_budget_id",
    });
  },

  async down(queryInterface) {
    if (!(await hasTable(queryInterface, "budget_alerts"))) {
      return;
    }

    await queryInterface.dropTable("budget_alerts");
  },
};

export default migration;


