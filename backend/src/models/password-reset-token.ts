import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class PasswordResetToken extends Model<
  InferAttributes<PasswordResetToken, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<PasswordResetToken, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare tokenHash: string;
  declare expiresAt: Date;
  declare usedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createPasswordResetTokenModel = (sequelize: Sequelize): typeof PasswordResetToken => {
  PasswordResetToken.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      modelName: "PasswordResetToken",
      tableName: "PasswordResetTokens",
      timestamps: true,
    },
  );
  return PasswordResetToken;
};

export { PasswordResetToken };
export default createPasswordResetTokenModel;

