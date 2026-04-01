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
const ensureIndex = async (queryInterface, tableName, indexName, fields, options) => {
    const indexes = await queryInterface.showIndex(tableName);
    if (indexes.some((idx) => idx.name === indexName))
        return;
    await queryInterface.addIndex(tableName, fields, { name: indexName, ...(options ?? {}) });
};
const migration = {
    async up(queryInterface, Sequelize) {
        if (await hasTable(queryInterface, "users")) {
            if (!(await hasColumn(queryInterface, "users", "password_hash"))) {
                await queryInterface.addColumn("users", "password_hash", {
                    type: Sequelize.STRING(255),
                    allowNull: false,
                    defaultValue: "",
                });
            }
        }
        if (await hasTable(queryInterface, "DemoRequests")) {
            if (!(await hasColumn(queryInterface, "DemoRequests", "heardAboutUs"))) {
                await queryInterface.addColumn("DemoRequests", "heardAboutUs", {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                    defaultValue: null,
                });
            }
            await dropIndexIfExists(queryInterface, "DemoRequests", "demo_requests_client_id");
            await dropIndexIfExists(queryInterface, "DemoRequests", "demo_requests_user_id");
            if (await hasColumn(queryInterface, "DemoRequests", "clientId")) {
                await queryInterface.removeColumn("DemoRequests", "clientId");
            }
            if (await hasColumn(queryInterface, "DemoRequests", "userId")) {
                await queryInterface.removeColumn("DemoRequests", "userId");
            }
            await queryInterface.addColumn("DemoRequests", "userId", {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            });
            await ensureIndex(queryInterface, "DemoRequests", "demo_requests_user_id", ["userId"]);
        }
        if (await hasTable(queryInterface, "AuthSessions")) {
            await dropIndexIfExists(queryInterface, "AuthSessions", "auth_sessions_client_id");
            await dropIndexIfExists(queryInterface, "AuthSessions", "auth_sessions_user_id");
            if (await hasColumn(queryInterface, "AuthSessions", "clientId")) {
                await queryInterface.removeColumn("AuthSessions", "clientId");
            }
            if (await hasColumn(queryInterface, "AuthSessions", "userId")) {
                await queryInterface.removeColumn("AuthSessions", "userId");
            }
            await queryInterface.addColumn("AuthSessions", "userId", {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            });
            await ensureIndex(queryInterface, "AuthSessions", "auth_sessions_user_id", ["userId"]);
        }
        if (await hasTable(queryInterface, "PasswordResetTokens")) {
            await dropIndexIfExists(queryInterface, "PasswordResetTokens", "password_reset_tokens_client_id");
            await dropIndexIfExists(queryInterface, "PasswordResetTokens", "password_reset_tokens_user_id");
            if (await hasColumn(queryInterface, "PasswordResetTokens", "clientId")) {
                await queryInterface.removeColumn("PasswordResetTokens", "clientId");
            }
            if (await hasColumn(queryInterface, "PasswordResetTokens", "userId")) {
                await queryInterface.removeColumn("PasswordResetTokens", "userId");
            }
            await queryInterface.addColumn("PasswordResetTokens", "userId", {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            });
            await ensureIndex(queryInterface, "PasswordResetTokens", "password_reset_tokens_user_id", ["userId"]);
        }
        if (await hasTable(queryInterface, "cloud_connections")) {
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_client_id");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_client_connection_name_unique");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_client_id_unique");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_user_id");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_user_connection_name_unique");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_user_id_unique");
            if (await hasColumn(queryInterface, "cloud_connections", "client_id")) {
                await queryInterface.removeColumn("cloud_connections", "client_id");
            }
            if (await hasColumn(queryInterface, "cloud_connections", "user_id")) {
                await queryInterface.removeColumn("cloud_connections", "user_id");
            }
            await queryInterface.addColumn("cloud_connections", "user_id", {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: "users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
            });
            await ensureIndex(queryInterface, "cloud_connections", "cloud_connections_user_id", ["user_id"]);
            await ensureIndex(queryInterface, "cloud_connections", "cloud_connections_user_connection_name_unique", ["user_id", "connection_name"], { unique: true });
            await ensureIndex(queryInterface, "cloud_connections", "cloud_connections_user_id_unique", ["user_id"], {
                unique: true,
            });
        }
    },
    async down(queryInterface, Sequelize) {
        if (await hasTable(queryInterface, "cloud_connections")) {
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_user_id_unique");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_user_connection_name_unique");
            await dropIndexIfExists(queryInterface, "cloud_connections", "cloud_connections_user_id");
            if (await hasColumn(queryInterface, "cloud_connections", "user_id")) {
                await queryInterface.removeColumn("cloud_connections", "user_id");
            }
            if (!(await hasColumn(queryInterface, "cloud_connections", "client_id"))) {
                await queryInterface.addColumn("cloud_connections", "client_id", {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                });
            }
        }
        if (await hasTable(queryInterface, "PasswordResetTokens")) {
            await dropIndexIfExists(queryInterface, "PasswordResetTokens", "password_reset_tokens_user_id");
            if (await hasColumn(queryInterface, "PasswordResetTokens", "userId")) {
                await queryInterface.removeColumn("PasswordResetTokens", "userId");
            }
            if (!(await hasColumn(queryInterface, "PasswordResetTokens", "clientId"))) {
                await queryInterface.addColumn("PasswordResetTokens", "clientId", {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                });
            }
        }
        if (await hasTable(queryInterface, "AuthSessions")) {
            await dropIndexIfExists(queryInterface, "AuthSessions", "auth_sessions_user_id");
            if (await hasColumn(queryInterface, "AuthSessions", "userId")) {
                await queryInterface.removeColumn("AuthSessions", "userId");
            }
            if (!(await hasColumn(queryInterface, "AuthSessions", "clientId"))) {
                await queryInterface.addColumn("AuthSessions", "clientId", {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                });
            }
        }
        if (await hasTable(queryInterface, "DemoRequests")) {
            await dropIndexIfExists(queryInterface, "DemoRequests", "demo_requests_user_id");
            if (await hasColumn(queryInterface, "DemoRequests", "userId")) {
                await queryInterface.removeColumn("DemoRequests", "userId");
            }
            if (!(await hasColumn(queryInterface, "DemoRequests", "clientId"))) {
                await queryInterface.addColumn("DemoRequests", "clientId", {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                });
            }
            if (await hasColumn(queryInterface, "DemoRequests", "heardAboutUs")) {
                await queryInterface.removeColumn("DemoRequests", "heardAboutUs");
            }
        }
        if (await hasTable(queryInterface, "users")) {
            if (await hasColumn(queryInterface, "users", "password_hash")) {
                await queryInterface.removeColumn("users", "password_hash");
            }
        }
    },
};
export default migration;

