/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
    async up(queryInterface) {
        await queryInterface.renameTable("slot_reservations", "SlotReservations");
    },
    async down(queryInterface) {
        await queryInterface.renameTable("SlotReservations", "slot_reservations");
    },
};
export default migration;




