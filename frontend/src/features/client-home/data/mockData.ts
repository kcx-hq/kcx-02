export type UploadStatus = "success" | "failed" | "processing"
export type TicketStatus = "open" | "in_progress" | "resolved"
export type AnnouncementType = "maintenance" | "feature" | "sla"
export type AwsConnectionStatus = "not_connected" | "pending" | "connected"

export type ClientHomepageData = {
  spend: {
    total30d: number
    mtd: number
    anomalies: number
  }
  uploads: Array<{
    id: string
    fileName: string
    status: UploadStatus
    time: string
  }>
  tickets: Array<{
    id: string
    title: string
    status: TicketStatus
  }>
  announcements: Array<{
    id: string
    title: string
    type: AnnouncementType
  }>
  awsConnection: {
    status: AwsConnectionStatus
  }
}

export const mockData: ClientHomepageData = {
  spend: {
    total30d: 0,
    mtd: 0,
    anomalies: 0,
  },
  uploads: [],
  tickets: [
    {
      id: "tic-1",
      title: "Need budget threshold update for Q2",
      status: "open",
    },
    {
      id: "tic-2",
      title: "Clarification on idle compute recommendation",
      status: "in_progress",
    },
    {
      id: "tic-3",
      title: "Monthly invoice export issue",
      status: "resolved",
    },
  ],
  announcements: [
    {
      id: "ann-1",
      title: "Scheduled maintenance window on Sunday",
      type: "maintenance",
    },
    {
      id: "ann-2",
      title: "CSV ingestion parser now supports extra tags",
      type: "feature",
    },
    {
      id: "ann-3",
      title: "SLA metrics dashboard refresh",
      type: "sla",
    },
  ],
  awsConnection: {
    status: "not_connected",
  },
}
