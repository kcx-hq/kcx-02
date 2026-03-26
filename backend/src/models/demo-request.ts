import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class DemoRequest extends Model<
  InferAttributes<DemoRequest, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<DemoRequest, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare firstName: string;
  declare lastName: string;
  declare companyEmail: string;
  declare companyName: string;
  declare heardAboutUs: string;
  declare status: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createDemoRequestModel = (sequelize: Sequelize): typeof DemoRequest => {
  DemoRequest.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      firstName: { type: DataTypes.STRING, allowNull: false },
      lastName: { type: DataTypes.STRING, allowNull: false },
      companyEmail: { type: DataTypes.STRING, allowNull: false },
      companyName: { type: DataTypes.STRING, allowNull: false },
      heardAboutUs: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "submitted" },
    },
    {
      sequelize,
      modelName: "DemoRequest",
      tableName: "DemoRequests",
      timestamps: true,
    },
  );
  return DemoRequest;
};

export { DemoRequest };
export default createDemoRequestModel;

