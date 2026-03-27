import type { QueryInterface } from "sequelize";

const migration = {
  async up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.renameTable("slot_reservations", "SlotReservations");
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.renameTable("SlotReservations", "slot_reservations");
  },
};

export default migration;
