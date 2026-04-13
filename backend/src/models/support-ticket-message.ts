import {
  CreationOptional,
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

class SupportTicketMessage extends Model<
  InferAttributes<SupportTicketMessage>,
  InferCreationAttributes<SupportTicketMessage>
> {
  declare id: CreationOptional<string>;
  declare ticketId: string;
  declare senderType: string;
  declare senderUserId: CreationOptional<string | null>;
  declare senderName: CreationOptional<string | null>;
  declare message: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

const createSupportTicketMessageModel = (sequelize: Sequelize): typeof SupportTicketMessage => {
  SupportTicketMessage.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },
      ticketId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "ticket_id",
      },
      senderType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "sender_type",
      },
      senderUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
        field: "sender_user_id",
      },
      senderName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        defaultValue: null,
        field: "sender_name",
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
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
      modelName: "SupportTicketMessage",
      tableName: "support_ticket_messages",
      timestamps: false,
      indexes: [
        {
          name: "idx_support_ticket_messages_ticket_id",
          fields: ["ticket_id"],
        },
        {
          name: "idx_support_ticket_messages_created_at",
          fields: ["created_at"],
        },
      ],
    },
  );

  return SupportTicketMessage;
};

export { SupportTicketMessage };
export default createSupportTicketMessageModel;
