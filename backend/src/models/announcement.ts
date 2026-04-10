import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type AnnouncementAudienceScope = "ALL" | "CLIENT_IDS" | "CLIENT_TIER";
export type AnnouncementAudienceTier = "PREMIUM" | "STANDARD";

class Announcement extends Model<
  InferAttributes<Announcement, { omit: "createdAt" | "updatedAt" }>,
  InferCreationAttributes<Announcement, { omit: "createdAt" | "updatedAt" }>
> {
  declare id: CreationOptional<string>;
  declare title: string;
  declare body: string;
  declare status: CreationOptional<AnnouncementStatus>;
  declare audience: CreationOptional<string>;
  declare audienceScope: CreationOptional<AnnouncementAudienceScope>;
  declare audienceClientIds: string[] | null;
  declare audienceTier: AnnouncementAudienceTier | null;
  declare publishAt: Date | null;
  declare expiresAt: Date | null;
  declare createdByAdminId: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createAnnouncementModel = (sequelize: Sequelize): typeof Announcement => {
  Announcement.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DRAFT" },
      audience: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ALL" },
      audienceScope: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "ALL",
        field: "audience_scope",
      },
      audienceClientIds: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: true,
        defaultValue: null,
        field: "audience_client_ids",
      },
      audienceTier: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null,
        field: "audience_tier",
      },
      publishAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "publish_at",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "expires_at",
      },
      createdByAdminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        field: "created_by_admin_id",
      },
    },
    {
      sequelize,
      modelName: "Announcement",
      tableName: "announcements",
      timestamps: true,
      underscored: true,
    },
  );

  return Announcement;
};

export { Announcement };
export default createAnnouncementModel;
