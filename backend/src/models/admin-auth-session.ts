import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class AdminAuthSession extends Model<
  InferAttributes<AdminAuthSession, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<AdminAuthSession, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare adminUserId: number;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createAdminAuthSessionModel = (sequelize: Sequelize): typeof AdminAuthSession => {
  AdminAuthSession.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      adminUserId: { type: DataTypes.INTEGER, allowNull: false },
      tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      modelName: "AdminAuthSession",
      tableName: "AdminAuthSessions",
      timestamps: true,
    },
  );
  return AdminAuthSession;
};

export { AdminAuthSession };
export default createAdminAuthSessionModel;

