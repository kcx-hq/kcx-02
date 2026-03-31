// @ts-nocheck
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
        try {
            await queryInterface.removeIndex(tableName, indexName);
        }
        catch {
            // ignore
        }
    },
};
export default migration;

