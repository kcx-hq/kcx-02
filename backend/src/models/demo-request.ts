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
  declare slotStart: Date | null;
  declare slotEnd: Date | null;
  declare status: CreationOptional<string>;
  declare calcomBookingId: string | null;
  declare calcomReservationId: string | null;
  declare meetingUrl: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createDemoRequestModel = (sequelize: Sequelize): typeof DemoRequest => {
  DemoRequest.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      slotStart: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      slotEnd: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "PENDING" },
      calcomBookingId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      calcomReservationId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      meetingUrl: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
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

