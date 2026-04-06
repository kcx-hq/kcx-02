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
const ensureIndex = async (queryInterface, tableName, indexName, fields) => {
    const indexes = await queryInterface.showIndex(tableName);
    if (indexes.some((idx) => idx.name === indexName))
        return;
    await queryInterface.addIndex(tableName, fields, { name: indexName });
};
const migration = {
    async up(queryInterface, Sequelize) {
        if (!(await hasTable(queryInterface, "Users"))) {
            await queryInterface.createTable("Users", {
                id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
                firstName: { type: Sequelize.STRING, allowNull: false },
                lastName: { type: Sequelize.STRING, allowNull: false },
                email: { type: Sequelize.STRING, allowNull: false, unique: true },
                passwordHash: { type: Sequelize.STRING, allowNull: false },
                companyName: { type: Sequelize.STRING, allowNull: true },
                role: { type: Sequelize.STRING, allowNull: false, defaultValue: "client" },
                status: { type: Sequelize.STRING, allowNull: false, defaultValue: "active" },
                source: { type: Sequelize.STRING, allowNull: false, defaultValue: "schedule_demo" },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE },
            });
        }
        if (!(await hasTable(queryInterface, "DemoRequests"))) {
            await queryInterface.createTable("DemoRequests", {
                id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: "Users", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                firstName: { type: Sequelize.STRING, allowNull: false },
                lastName: { type: Sequelize.STRING, allowNull: false },
                companyEmail: { type: Sequelize.STRING, allowNull: false },
                companyName: { type: Sequelize.STRING, allowNull: false },
                heardAboutUs: { type: Sequelize.STRING, allowNull: false },
                status: { type: Sequelize.STRING, allowNull: false, defaultValue: "submitted" },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE },
            });
        }
        await ensureIndex(queryInterface, "DemoRequests", "demo_requests_user_id", ["userId"]);
        if (!(await hasTable(queryInterface, "PasswordResetTokens"))) {
            await queryInterface.createTable("PasswordResetTokens", {
                id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: "Users", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                tokenHash: { type: Sequelize.STRING, allowNull: false, unique: true },
                expiresAt: { type: Sequelize.DATE, allowNull: false },
                usedAt: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE },
            });
        }
        await ensureIndex(queryInterface, "PasswordResetTokens", "password_reset_tokens_user_id", ["userId"]);
        if (!(await hasTable(queryInterface, "AuthSessions"))) {
            await queryInterface.createTable("AuthSessions", {
                id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
                userId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: "Users", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                },
                tokenHash: { type: Sequelize.STRING, allowNull: false, unique: true },
                expiresAt: { type: Sequelize.DATE, allowNull: false },
                revokedAt: { type: Sequelize.DATE, allowNull: true, defaultValue: null },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE },
            });
        }
        await ensureIndex(queryInterface, "AuthSessions", "auth_sessions_user_id", ["userId"]);
    },
    async down(queryInterface) {
        await queryInterface.dropTable("AuthSessions");
        await queryInterface.dropTable("PasswordResetTokens");
        await queryInterface.dropTable("DemoRequests");
        await queryInterface.dropTable("Users");
    },
};
export default migration;




