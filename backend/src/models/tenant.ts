import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type TenantStatus = "active" | "inactive";

class Tenant extends Model<
  InferAttributes<Tenant, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<Tenant, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare status: TenantStatus | string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createTenantModel = (sequelize: Sequelize): typeof Tenant => {
  Tenant.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: sequelize.literal("gen_random_uuid()") },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(150), allowNull: false, unique: true },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "active" },
    },
    {
      sequelize,
      modelName: "Tenant",
      tableName: "tenants",
      timestamps: true,
      underscored: true,
    },
  );
  return Tenant;
};

export { Tenant };
export default createTenantModel;

