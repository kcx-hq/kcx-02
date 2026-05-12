import type { QueryInterface } from "sequelize";

const migration = {
  async up(_queryInterface: QueryInterface): Promise<void> {
    const { sequelize } = await import("../models/index.js");

    // Create any missing tables/constraints from current model definitions.
    await sequelize.sync({ alter: false });
  },

  async down(_queryInterface: QueryInterface): Promise<void> {
    // Irreversible on purpose: this migration aligns schema to models
    // and should not drop existing tables/data on rollback.
  },
};

export default migration;
