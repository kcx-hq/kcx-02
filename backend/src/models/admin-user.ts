import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type AdminUserStatus = "active" | "blocked";

class AdminUser extends Model<
  InferAttributes<AdminUser, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<AdminUser, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare passwordHash: string;
  declare role: string;
  declare status: AdminUserStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createAdminUserModel = (sequelize: Sequelize): typeof AdminUser => {
  AdminUser.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.STRING, allowNull: false, defaultValue: "admin" },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    },
    {
      sequelize,
      modelName: "AdminUser",
      tableName: "AdminUsers",
      timestamps: true,
    },
  );
  return AdminUser;
};

export { AdminUser };
export default createAdminUserModel;

