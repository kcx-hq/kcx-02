import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class AwsCloudConnection extends Model<
  InferAttributes<AwsCloudConnection, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<AwsCloudConnection, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare cloudConnectionId: string;
  declare awsAccountId: string | null;
  declare bucketName: string;
  declare bucketPrefix: string | null;
  declare setupMethod: CreationOptional<string>;
  declare roleArn: string | null;
  declare externalId: string | null;
  declare reportName: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createAwsCloudConnectionModel = (sequelize: Sequelize): typeof AwsCloudConnection => {
  AwsCloudConnection.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      cloudConnectionId: { type: DataTypes.UUID, allowNull: false, unique: true },
      awsAccountId: { type: DataTypes.STRING(12), allowNull: true, defaultValue: null },
      bucketName: { type: DataTypes.STRING(255), allowNull: false },
      bucketPrefix: { type: DataTypes.STRING(1024), allowNull: true, defaultValue: null },
      setupMethod: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "manual" },
      roleArn: { type: DataTypes.STRING(512), allowNull: true, defaultValue: null },
      externalId: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
      reportName: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      modelName: "AwsCloudConnection",
      tableName: "AwsCloudConnections",
      timestamps: true,
    },
  );
  return AwsCloudConnection;
};

export { AwsCloudConnection };
export default createAwsCloudConnectionModel;
