import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type CloudConnectionProvider = "aws" | "azure" | "gcp" | "oracle" | "custom";
export type CloudConnectionStatus = "draft" | "active" | "disabled" | "error";
export type CloudConnectionAccountType = "payer" | "linked";

class CloudConnection extends Model<
  InferAttributes<CloudConnection, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<CloudConnection, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare clientId: number;
  declare connectionName: string;
  declare provider: CloudConnectionProvider | string;
  declare status: CloudConnectionStatus | string;
  declare accountType: CloudConnectionAccountType | string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCloudConnectionModel = (sequelize: Sequelize): typeof CloudConnection => {
  CloudConnection.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      clientId: { type: DataTypes.INTEGER, allowNull: false, field: "client_id" },
      connectionName: { type: DataTypes.STRING, allowNull: false, field: "connection_name" },
      provider: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "draft" },
      accountType: { type: DataTypes.STRING, allowNull: false, defaultValue: "payer", field: "account_type" },
    },
    {
      sequelize,
      modelName: "CloudConnection",
      tableName: "cloud_connections",
      timestamps: true,
      underscored: true,
    },
  );
  return CloudConnection;
};

export { CloudConnection };
export default createCloudConnectionModel;

