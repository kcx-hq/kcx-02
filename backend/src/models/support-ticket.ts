import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type SupportTicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type SupportTicketStatus = "Open" | "Under Review" | "Resolved" | "Closed" | "Draft" | "Cancelled by Client";

class SupportTicket extends Model<
  InferAttributes<SupportTicket>,
  InferCreationAttributes<SupportTicket>
> {
  declare id: CreationOptional<string>;
  declare tenantId: string;
  declare createdBy: CreationOptional<string | null>;
  declare ticketCode: string;
  declare title: string;
  declare issueCategory: string;
  declare priority: SupportTicketPriority | string;
  declare affected: string;
  declare attachments: CreationOptional<string[]>;
  declare description: string;
  declare status: CreationOptional<SupportTicketStatus | string>;
  declare progress: CreationOptional<string>;
  declare assignedTeam: CreationOptional<string | null>;
  declare workflowStage: CreationOptional<string>;
  declare slaDeadlineAt: CreationOptional<Date | null>;
  declare clientRespondedAt: CreationOptional<Date | null>;
  declare lastUpdatedAt: CreationOptional<Date>;
  declare closedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createSupportTicketModel = (sequelize: Sequelize): typeof SupportTicket => {
  SupportTicket.init(
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
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "created_by",
      },
      ticketCode: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "ticket_code",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      issueCategory: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "issue_category",
      },
      priority: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Medium",
      },
      affected: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      attachments: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: false,
        defaultValue: [],
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Under Review",
      },
      progress: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "NEW",
      },
      assignedTeam: {
        type: DataTypes.STRING(80),
        allowNull: true,
        defaultValue: null,
        field: "assigned_team",
      },
      workflowStage: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: "Submitted to KCX",
        field: "workflow_stage",
      },
      slaDeadlineAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "sla_deadline_at",
      },
      lastUpdatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("NOW()"),
        field: "last_updated_at",
      },
      clientRespondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "client_responded_at",
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
        field: "closed_at",
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
      modelName: "SupportTicket",
      tableName: "support_tickets",
      timestamps: false,
      indexes: [
        {
          name: "uq_support_tickets_ticket_code",
          unique: true,
          fields: ["ticket_code"],
        },
        {
          name: "idx_support_tickets_tenant_id",
          fields: ["tenant_id"],
        },
        {
          name: "idx_support_tickets_status",
          fields: ["status"],
        },
        {
          name: "idx_support_tickets_progress",
          fields: ["progress"],
        },
        {
          name: "idx_support_tickets_created_by",
          fields: ["created_by"],
        },
      ],
    },
  );

  return SupportTicket;
};

export { SupportTicket };
export default createSupportTicketModel;
