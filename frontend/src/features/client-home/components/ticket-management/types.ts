export type TicketTableStatus = "Open" | "Under Review" | "Resolved" | "Closed" | "Draft" | "Cancelled by Client"

export type TicketView = "created" | "draft"

export type TicketPriority = "Low" | "Medium" | "High" | "Urgent"

export type TicketItem = {
  id: string
  title: string
  code: string
  createdBy: string
  category: string
  priority: TicketPriority
  status: TicketTableStatus
  progress: "NEW" | "IN_PROGRESS" | "CLIENT_REVIEW" | "RESOLVED" | "CLOSED"
  workflowStage: string
  createdDate: string
  lastUpdated: string
  slaDeadline: string
  attachments: string
  attachmentFiles: string[]
  affected: string
  description: string
  canClientResolve: boolean
  canClientCancel: boolean
}

export type TicketCreatePayload = {
  title: string
  category: string
  priority: TicketPriority
  affected: string
  attachments: string[]
  description: string
  saveAsDraft?: boolean
}

export type TicketMessage = {
  id: string
  sender_type: "ADMIN" | "CLIENT" | string
  sender_name: string | null
  message: string
  created_at: string
}

export type ClientTicketAction = "RESOLVED" | "UNRESOLVED" | "CANCEL"
