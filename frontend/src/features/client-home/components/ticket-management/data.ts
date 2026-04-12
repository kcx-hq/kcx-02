import type { TicketItem } from "@/features/client-home/components/ticket-management/types"

export const CREATED_TICKETS: TicketItem[] = [
  {
    id: "ticket-1",
    title: "Technical issue",
    code: "TIC-884D52D0",
    createdBy: "Janu Ashokbhai Gohil",
    category: "Billing Ingestion",
    priority: "Medium",
    status: "Under Review",
    progress: "IN_PROGRESS",
    workflowStage: "In Progress",
    createdDate: "18/03/2026, 12:59:51 PM",
    lastUpdated: "28/03/2026, 12:15:34 PM",
    slaDeadline: "--",
    attachments: "None",
    attachmentFiles: [],
    affected: "Billing dashboard",
    description: "Sample seeded ticket for local UI testing.",
    canClientResolve: false,
    canClientCancel: true,
  },
]

export const DRAFT_TICKETS: TicketItem[] = []
