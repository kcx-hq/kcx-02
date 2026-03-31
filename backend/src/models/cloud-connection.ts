import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class CloudConnection extends Model<
  InferAttributes<CloudConnection, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<CloudConnection, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare clientId: number;
  declare provider: string;
  declare connectionName: CreationOptional<string>;
  declare setupMode: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare currentStep: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare lastValidatedAt: Date | null;
  declare lastSyncAt: Date | null;
  declare lastSuccessAt: Date | null;
  declare lastError: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCloudConnectionModel = (sequelize: Sequelize): typeof CloudConnection => {
  CloudConnection.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      clientId: { type: DataTypes.INTEGER, allowNull: false },
      provider: { type: DataTypes.STRING(50), allowNull: false },
      connectionName: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "AWS Connection" },
      setupMode: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "manual" },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "DRAFT" },
      currentStep: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lastValidatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      lastSyncAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      lastSuccessAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      lastError: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      modelName: "CloudConnection",
      tableName: "CloudConnections",
      timestamps: true,
    },
  );
  return CloudConnection;
};

export { CloudConnection };
export default createCloudConnectionModel;
