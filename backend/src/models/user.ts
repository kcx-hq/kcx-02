import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type UserStatus = "active" | "pending" | "blocked";
export type UserSource = "schedule_demo" | "admin" | "import";

class User extends Model<
  InferAttributes<User, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<User, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare firstName: string;
  declare lastName: string;
  declare email: string;
  declare passwordHash: string;
  declare companyName: string | null;
  declare role: string;
  declare status: UserStatus;
  declare source: UserSource;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createUserModel = (sequelize: Sequelize): typeof User => {
  User.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      firstName: { type: DataTypes.STRING, allowNull: false },
      lastName: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      companyName: { type: DataTypes.STRING, allowNull: true },
      role: { type: DataTypes.STRING, allowNull: false, defaultValue: "client" },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
      source: { type: DataTypes.STRING, allowNull: false, defaultValue: "schedule_demo" },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "Users",
      timestamps: true,
    },
  );
  return User;
};

export { User };
export default createUserModel;

