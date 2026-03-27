const migration = {
  async up(queryInterface: any) {
    await queryInterface.renameTable("slot_reservations", "SlotReservations");
  },

  async down(queryInterface: any) {
    await queryInterface.renameTable("SlotReservations", "slot_reservations");
  },
};

export default migration;

