/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

const migration = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("fact_anomalies", "cloud_connection_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "cloud_connections", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("fact_anomalies", "cloud_connection_id", {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "cloud_connections", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },
};

export default migration;

