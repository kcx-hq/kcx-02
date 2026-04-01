import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type CloudProviderStatus = "active" | "inactive";

class CloudProvider extends Model<
  InferAttributes<CloudProvider, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<CloudProvider, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare name: string;
  declare status: CloudProviderStatus | string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createCloudProviderModel = (sequelize: Sequelize): typeof CloudProvider => {
  CloudProvider.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "active" },
    },
    {
      sequelize,
      modelName: "CloudProvider",
      tableName: "cloud_providers",
      timestamps: true,
      underscored: true,
    },
  );
  return CloudProvider;
};

export { CloudProvider };
export default createCloudProviderModel;

