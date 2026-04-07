/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("DemoRequests", "slotStart", {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });
        await queryInterface.addColumn("DemoRequests", "slotEnd", {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });
        await queryInterface.addColumn("DemoRequests", "calcomBookingId", {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        });
        await queryInterface.addColumn("DemoRequests", "calcomReservationId", {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        });
        await queryInterface.changeColumn("DemoRequests", "status", {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "PENDING",
        });
        await queryInterface.createTable("slot_reservations", {
            id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
            demoRequestId: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: { model: "DemoRequests", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL",
            },
            slotStart: { type: Sequelize.DATE, allowNull: false },
            slotEnd: { type: Sequelize.DATE, allowNull: false },
            reservationExpiresAt: { type: Sequelize.DATE, allowNull: false },
            calcomReservationId: { type: Sequelize.STRING, allowNull: false },
            status: { type: Sequelize.STRING, allowNull: false, defaultValue: "RESERVED" },
            createdAt: { allowNull: false, type: Sequelize.DATE },
            updatedAt: { allowNull: false, type: Sequelize.DATE },
        });
        await queryInterface.addIndex("slot_reservations", ["demoRequestId"]);
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable("slot_reservations");
        await queryInterface.changeColumn("DemoRequests", "status", {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "submitted",
        });
        await queryInterface.removeColumn("DemoRequests", "calcomReservationId");
        await queryInterface.removeColumn("DemoRequests", "calcomBookingId");
        await queryInterface.removeColumn("DemoRequests", "slotEnd");
        await queryInterface.removeColumn("DemoRequests", "slotStart");
    },
};
export default migration;




