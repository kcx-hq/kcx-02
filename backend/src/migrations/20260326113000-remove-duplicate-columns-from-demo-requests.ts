/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasColumn = async (queryInterface, tableName, columnName) => {
    try {
        const columns = await queryInterface.describeTable(tableName);
        return Boolean(columns[columnName]);
    }
    catch {
        return false;
    }
};
const migration = {
    async up(queryInterface) {
        if (await hasColumn(queryInterface, "DemoRequests", "firstName")) {
            await queryInterface.removeColumn("DemoRequests", "firstName");
        }
        if (await hasColumn(queryInterface, "DemoRequests", "lastName")) {
            await queryInterface.removeColumn("DemoRequests", "lastName");
        }
        if (await hasColumn(queryInterface, "DemoRequests", "companyEmail")) {
            await queryInterface.removeColumn("DemoRequests", "companyEmail");
        }
        if (await hasColumn(queryInterface, "DemoRequests", "companyName")) {
            await queryInterface.removeColumn("DemoRequests", "companyName");
        }
        if (await hasColumn(queryInterface, "DemoRequests", "heardAboutUs")) {
            await queryInterface.removeColumn("DemoRequests", "heardAboutUs");
        }
    },
    async down(queryInterface, Sequelize) {
        if (!(await hasColumn(queryInterface, "DemoRequests", "firstName"))) {
            await queryInterface.addColumn("DemoRequests", "firstName", {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: "",
            });
        }
        if (!(await hasColumn(queryInterface, "DemoRequests", "lastName"))) {
            await queryInterface.addColumn("DemoRequests", "lastName", {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: "",
            });
        }
        if (!(await hasColumn(queryInterface, "DemoRequests", "companyEmail"))) {
            await queryInterface.addColumn("DemoRequests", "companyEmail", {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: "",
            });
        }
        if (!(await hasColumn(queryInterface, "DemoRequests", "companyName"))) {
            await queryInterface.addColumn("DemoRequests", "companyName", {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: "",
            });
        }
        if (!(await hasColumn(queryInterface, "DemoRequests", "heardAboutUs"))) {
            await queryInterface.addColumn("DemoRequests", "heardAboutUs", {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: "",
            });
        }
    },
};
export default migration;




