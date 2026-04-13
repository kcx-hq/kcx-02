import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type SupportMeetingStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "RESCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

class SupportMeeting extends Model<
  InferAttributes<SupportMeeting>,
  InferCreationAttributes<SupportMeeting>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare requestedBy: string;
  declare approvedByAdminId: CreationOptional<number | null>;
  declare meetingCode: string;
  declare meetingType: string;
  declare agenda: string;
  declare mode: CreationOptional<string>;
  declare status: CreationOptional<SupportMeetingStatus | string>;
  declare slotStart: Date;
  declare slotEnd: Date;
  declare timeZone: string;
  declare meetingUrl: CreationOptional<string | null>;
  declare afterMeetingSummary: CreationOptional<string | null>;
  declare approvedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createSupportMeetingModel = (sequelize: Sequelize): typeof SupportMeeting => {
  SupportMeeting.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "tenant_id",
      },
      requestedBy: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "requested_by",
      },
      approvedByAdminId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "approved_by_admin_id",
      },
      meetingCode: {
        type: DataTypes.STRING(40),
        allowNull: false,
        unique: true,
        field: "meeting_code",
      },
      meetingType: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "meeting_type",
      },
      agenda: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      mode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Google Meet",
      },
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "REQUESTED",
      },
      slotStart: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "slot_start",
      },
      slotEnd: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "slot_end",
      },
      timeZone: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: "time_zone",
      },
      meetingUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: "meeting_url",
      },
      afterMeetingSummary: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
        field: "after_meeting_summary",
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "approved_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "updated_at",
      },
    },
    {
      sequelize,
      modelName: "SupportMeeting",
      tableName: "support_meetings",
      timestamps: false,
      indexes: [
        { name: "uq_support_meetings_meeting_code", unique: true, fields: ["meeting_code"] },
        { name: "idx_support_meetings_tenant_id", fields: ["tenant_id"] },
        { name: "idx_support_meetings_requested_by", fields: ["requested_by"] },
        { name: "idx_support_meetings_status", fields: ["status"] },
        { name: "idx_support_meetings_slot_start", fields: ["slot_start"] },
      ],
    },
  );

  return SupportMeeting;
};

export { SupportMeeting };
export default createSupportMeetingModel;
