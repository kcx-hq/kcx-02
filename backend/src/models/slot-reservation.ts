import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class SlotReservation extends Model<
  InferAttributes<SlotReservation, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<SlotReservation, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<number>;
  declare demoRequestId: number | null;
  declare slotStart: Date;
  declare slotEnd: Date;
  declare reservationExpiresAt: Date;
  declare calcomReservationId: string;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createSlotReservationModel = (sequelize: Sequelize): typeof SlotReservation => {
  SlotReservation.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      demoRequestId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      slotStart: { type: DataTypes.DATE, allowNull: false },
      slotEnd: { type: DataTypes.DATE, allowNull: false },
      reservationExpiresAt: { type: DataTypes.DATE, allowNull: false },
      calcomReservationId: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: "RESERVED" },
    },
    {
      sequelize,
      modelName: "SlotReservation",
      tableName: "SlotReservations",
      timestamps: true,
    },
  );
  return SlotReservation;
};

export { SlotReservation };
export default createSlotReservationModel;
