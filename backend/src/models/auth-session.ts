import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class AuthSession extends Model<
  InferAttributes<AuthSession, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<AuthSession, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createAuthSessionModel = (sequelize: Sequelize): typeof AuthSession => {
  AuthSession.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      modelName: "AuthSession",
      tableName: "AuthSessions",
      timestamps: true,
    },
  );
  return AuthSession;
};

export { AuthSession };
export default createAuthSessionModel;

