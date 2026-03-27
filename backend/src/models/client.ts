import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type ClientStatus = "active" | "pending" | "blocked";
export type ClientSource = "schedule_demo" | "import";

class Client extends Model<
  InferAttributes<Client, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<Client, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare firstName: string;
  declare lastName: string;
  declare email: string;
  declare passwordHash: string;
  declare companyName: string | null;
  declare heardAboutUs: string | null;
  declare role: string;
  declare status: ClientStatus;
  declare source: ClientSource;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createClientModel = (sequelize: Sequelize): typeof Client => {
  Client.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      firstName: { type: DataTypes.STRING, allowNull: false },
      lastName: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      companyName: { type: DataTypes.STRING, allowNull: true },
      heardAboutUs: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      role: { type: DataTypes.STRING, allowNull: false, defaultValue: "client" },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
      source: { type: DataTypes.STRING, allowNull: false, defaultValue: "schedule_demo" },
    },
    {
      sequelize,
      modelName: "Client",
      tableName: "Clients",
      timestamps: true,
    },
  );
  return Client;
};

export { Client };
export default createClientModel;

