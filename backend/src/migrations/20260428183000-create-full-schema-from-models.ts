import type { QueryInterface } from "sequelize";

const migration = {
  async up(_queryInterface: QueryInterface): Promise<void> {
    const { sequelize } = await import("../models/index.js");

    // Build full schema from the current Sequelize models in one pass.
    await sequelize.sync({ alter: false });
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // Intentionally left empty to avoid accidental destructive rollback.
  },
};

export default migration;
