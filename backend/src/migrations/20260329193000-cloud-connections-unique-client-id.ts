/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const hasTable = async (queryInterface, tableName) => {
    try {
        await queryInterface.describeTable(tableName);
        return true;
    }
    catch {
        return false;
    }
};
const hasColumn = async (queryInterface, tableName, columnName) => {
    try {
        const columns = await queryInterface.describeTable(tableName);
        return Boolean(columns[columnName]);
    }
    catch {
        return false;
    }
};
const hasIndex = async (queryInterface, tableName, indexName) => {
    try {
        const indexes = await queryInterface.showIndex(tableName);
        return indexes.some((idx) => idx.name === indexName);
    }
    catch {
        return false;
    }
};
const migration = {
    async up(queryInterface) {
        const tableName = "cloud_connections";
        const indexName = "cloud_connections_client_id_unique";
        if (!(await hasTable(queryInterface, tableName)))
            return;
        if (!(await hasColumn(queryInterface, tableName, "client_id")))
            return;
        if (await hasIndex(queryInterface, tableName, indexName))
            return;
        await queryInterface.addIndex(tableName, ["client_id"], {
            name: indexName,
            unique: true,
        });
    },
    async down(queryInterface) {
        const tableName = "cloud_connections";
        const indexName = "cloud_connections_client_id_unique";
        if (!(await hasTable(queryInterface, tableName)))
            return;
        try {
            await queryInterface.removeIndex(tableName, indexName);
        }
        catch {
            // ignore
        }
    },
};
export default migration;



