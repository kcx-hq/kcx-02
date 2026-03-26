import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class Temp extends Model<
  InferAttributes<Temp, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<Temp, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createTempModel = (sequelize: Sequelize): typeof Temp => {
  Temp.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Temp",
      tableName: "Temps",
      timestamps: true,
    }
  );

  return Temp;
};

export { Temp };
export default createTempModel;
