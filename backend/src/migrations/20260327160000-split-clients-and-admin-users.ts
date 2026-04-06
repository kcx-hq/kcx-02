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
const dropIndexIfExists = async (queryInterface, tableName, indexName) => {
    try {
        const indexes = await queryInterface.showIndex(tableName);
        if (!indexes.some((idx) => idx.name === indexName))
            return;
        await queryInterface.removeIndex(tableName, indexName);
    }
    catch {
        // ignore
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
        const usersExists = await hasTable(queryInterface, "Users");
        const clientsExists = await hasTable(queryInterface, "Clients");
        if (usersExists && !clientsExists) {
            await queryInterface.renameTable("Users", "Clients");
        }
        if (await hasTable(queryInterface, "Clients")) {
            const heardAboutUsExists = await hasColumn(queryInterface, "Clients", "heardAboutUs");
            if (!heardAboutUsExists) {
                await queryInterface.addColumn("Clients", "heardAboutUs", {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: null,
                });
            }
        }
        await dropIndexIfExists(queryInterface, "DemoRequests", "demo_requests_user_id");
        await dropIndexIfExists(queryInterface, "PasswordResetTokens", "password_reset_tokens_user_id");
        await dropIndexIfExists(queryInterface, "AuthSessions", "auth_sessions_user_id");
        if ((await hasColumn(queryInterface, "DemoRequests", "userId")) &&
            !(await hasColumn(queryInterface, "DemoRequests", "clientId"))) {
            await queryInterface.renameColumn("DemoRequests", "userId", "clientId");
        }
        if ((await hasColumn(queryInterface, "PasswordResetTokens", "userId")) &&
            !(await hasColumn(queryInterface, "PasswordResetTokens", "clientId"))) {
            await queryInterface.renameColumn("PasswordResetTokens", "userId", "clientId");
        }
        if ((await hasColumn(queryInterface, "AuthSessions", "userId")) &&
            !(await hasColumn(queryInterface, "AuthSessions", "clientId"))) {
            await queryInterface.renameColumn("AuthSessions", "userId", "clientId");
        }
        await ensureIndex(queryInterface, "DemoRequests", "demo_requests_client_id", ["clientId"]);
        await ensureIndex(queryInterface, "PasswordResetTokens", "password_reset_tokens_client_id", ["clientId"]);
        await ensureIndex(queryInterface, "AuthSessions", "auth_sessions_client_id", ["clientId"]);
        if (!(await hasTable(queryInterface, "AdminUsers"))) {
            await queryInterface.createTable("AdminUsers", {
                id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
                email: { type: Sequelize.STRING, allowNull: false, unique: true },
                passwordHash: { type: Sequelize.STRING, allowNull: false },
                role: { type: Sequelize.STRING, allowNull: false, defaultValue: "admin" },
                status: { type: Sequelize.STRING, allowNull: false, defaultValue: "active" },
                createdAt: { allowNull: false, type: Sequelize.DATE },
                updatedAt: { allowNull: false, type: Sequelize.DATE },
            });
        }
        if (!(await hasTable(queryInterface, "AdminAuthSessions"))) {
            await queryInterface.createTable("AdminAuthSessions", {
                id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
                adminUserId: {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                    references: { model: "AdminUsers", key: "id" },
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
        await ensureIndex(queryInterface, "AdminAuthSessions", "admin_auth_sessions_admin_user_id", [
            "adminUserId",
        ]);
    },
    async down(queryInterface) {
        await queryInterface.dropTable("AdminAuthSessions");
        await queryInterface.dropTable("AdminUsers");
        await dropIndexIfExists(queryInterface, "DemoRequests", "demo_requests_client_id");
        await dropIndexIfExists(queryInterface, "PasswordResetTokens", "password_reset_tokens_client_id");
        await dropIndexIfExists(queryInterface, "AuthSessions", "auth_sessions_client_id");
        if ((await hasColumn(queryInterface, "DemoRequests", "clientId")) &&
            !(await hasColumn(queryInterface, "DemoRequests", "userId"))) {
            await queryInterface.renameColumn("DemoRequests", "clientId", "userId");
        }
        if ((await hasColumn(queryInterface, "PasswordResetTokens", "clientId")) &&
            !(await hasColumn(queryInterface, "PasswordResetTokens", "userId"))) {
            await queryInterface.renameColumn("PasswordResetTokens", "clientId", "userId");
        }
        if ((await hasColumn(queryInterface, "AuthSessions", "clientId")) &&
            !(await hasColumn(queryInterface, "AuthSessions", "userId"))) {
            await queryInterface.renameColumn("AuthSessions", "clientId", "userId");
        }
        if (await hasTable(queryInterface, "Clients")) {
            if (await hasColumn(queryInterface, "Clients", "heardAboutUs")) {
                await queryInterface.removeColumn("Clients", "heardAboutUs");
            }
        }
        const clientsExists = await hasTable(queryInterface, "Clients");
        const usersExists = await hasTable(queryInterface, "Users");
        if (clientsExists && !usersExists) {
            await queryInterface.renameTable("Clients", "Users");
        }
        await ensureIndex(queryInterface, "DemoRequests", "demo_requests_user_id", ["userId"]);
        await ensureIndex(queryInterface, "PasswordResetTokens", "password_reset_tokens_user_id", ["userId"]);
        await ensureIndex(queryInterface, "AuthSessions", "auth_sessions_user_id", ["userId"]);
    },
};
export default migration;




