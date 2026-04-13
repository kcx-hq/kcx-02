import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type UserStatus = "active" | "inactive" | "invited" | "pending_approval";

class User extends Model<
  InferAttributes<User, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<User, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare fullName: string;
  declare email: string;
  declare passwordHash: string;
  declare role: string;
  declare status: UserStatus | string;
  declare invitedByUserId: string | null;
  declare invitedAt: Date | null;
  declare approvedByUserId: string | null;
  declare approvedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createUserModel = (sequelize: Sequelize): typeof User => {
  User.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      fullName: { type: DataTypes.STRING(150), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "active" },
      invitedByUserId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
      invitedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      approvedByUserId: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
      approvedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
      underscored: true,
    },
  );
  return User;
};

export { User };
export default createUserModel;
