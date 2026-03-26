import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ActionCard } from "@/features/client-home/components/ActionCard"
import { ActivityList } from "@/features/client-home/components/ActivityList"
import { ClientTopNavbar } from "@/features/client-home/components/ClientTopNavbar"
import { StatCard } from "@/features/client-home/components/StatCard"
import { mockData } from "@/features/client-home/data/mockData"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function getUploadStatusBadge(status: "success" | "failed" | "processing") {
  if (status === "success") {
    return (
      <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">
        Successful
      </Badge>
    )
  }

  if (status === "failed") {
    return (
      <Badge variant="outline" className="rounded-md border-rose-200 bg-rose-50 text-rose-700">
        Failed
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">
      Processing
    </Badge>
  )
}

function getTicketStatusBadge(status: "open" | "in_progress" | "resolved") {
  if (status === "resolved") {
    return (
      <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">
        Resolved
      </Badge>
    )
  }
  if (status === "in_progress") {
    return (
      <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">
        In Progress
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="rounded-md border-sky-200 bg-sky-50 text-sky-700">
      Open
    </Badge>
  )
}

function getAnnouncementBadge(type: "maintenance" | "feature" | "sla") {
  if (type === "maintenance") {
    return (
      <Badge variant="outline" className="rounded-md border-slate-300 bg-slate-100 text-slate-700">
        Maintenance
      </Badge>
    )
  }

  if (type === "feature") {
    return (
      <Badge variant="outline" className="rounded-md border-indigo-200 bg-indigo-50 text-indigo-700">
        Feature
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="rounded-md border-cyan-200 bg-cyan-50 text-cyan-700">
      SLA
    </Badge>
  )
}

export function ClientOverviewPage() {
  const uploads = mockData.uploads
  const awsStatus = mockData.awsConnection.status

  const hasSpendData = uploads.length > 0 || awsStatus === "connected"
  const hasFailedUploads = uploads.some((upload) => upload.status === "failed")
  const isOnboardingState = uploads.length === 0 && awsStatus === "not_connected"

  const uploadStats = {
    total: uploads.length,
    success: uploads.filter((upload) => upload.status === "success").length,
    failed: uploads.filter((upload) => upload.status === "failed").length,
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg-main)] text-text-primary">
      <ClientTopNavbar orgName="Acme Cloud Services" />

      <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
        <div className="space-y-6">
          <section aria-label="FinOps status strip" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Total 30 Day Spend"
              value={formatCurrency(mockData.spend.total30d)}
              subtext="Trend available after data ingestion"
              hasData={hasSpendData}
            />
            <StatCard
              title="Month-to-Date Spend"
              value={formatCurrency(mockData.spend.mtd)}
              subtext="Trend available after data ingestion"
              hasData={hasSpendData}
            />
            <StatCard
              title="Anomaly Status"
              value={mockData.spend.anomalies > 0 ? formatCurrency(mockData.spend.anomalies) : "No anomalies"}
              subtext={
                mockData.spend.anomalies > 0
                  ? "Review anomaly monitor for current month"
                  : "No anomaly signals detected"
              }
              hasData={hasSpendData}
            />
          </section>

          {isOnboardingState ? (
            <section aria-label="Get started with KCX">
              <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--kcx-card-light)] shadow-sm-custom">
                <CardContent className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-4">
                    <p className="kcx-eyebrow text-brand-primary">Onboarding</p>
                    <h1 className="kcx-heading text-2xl font-semibold tracking-tight text-text-primary">Get started with KCX</h1>
                    <ol className="space-y-2 text-sm text-text-secondary">
                      <li>1. Upload your billing CSV</li>
                      <li>2. Or connect AWS</li>
                    </ol>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-stretch lg:flex-row">
                    <Button className="h-11 rounded-md">Upload CSV</Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-md border-[color:var(--border-light)] bg-transparent"
                    >
                      Connect AWS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          ) : (
            <>
              <section aria-label="Start FinOps" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ActionCard
                  title="Upload Billing Data"
                  description="Upload your latest billing CSV to begin spend analysis and trend visibility."
                  ctaLabel="Upload CSV"
                  emphasized
                  stats={[
                    { label: "Total uploads", value: String(uploadStats.total) },
                    { label: "Successful uploads", value: String(uploadStats.success) },
                    { label: "Failed uploads", value: String(uploadStats.failed) },
                  ]}
                />

                <ActionCard
                  title="Connect AWS Account"
                  description="Set up automated billing ingestion."
                  ctaLabel="Start Setup"
                  status={
                    <Badge variant="outline" className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary">
                      {awsStatus === "connected"
                        ? "Connected"
                        : awsStatus === "pending"
                          ? "Pending"
                          : "Not Connected"}
                    </Badge>
                  }
                />
              </section>

              <section aria-label="Activity panels" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                <ActivityList
                  title="Recent Uploads"
                  rows={uploads}
                  emptyText="No uploads yet. Upload your first billing CSV to activate cost tracking."
                  columns={[
                    {
                      key: "file",
                      label: "File Name",
                      render: (row) => <span className="font-medium text-text-primary">{row.fileName}</span>,
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => getUploadStatusBadge(row.status),
                    },
                    {
                      key: "time",
                      label: "Time",
                      render: (row) => row.time,
                    },
                  ]}
                />

                <ActivityList
                  title="Ticket Activity"
                  rows={mockData.tickets}
                  emptyText="No ticket activity yet."
                  columns={[
                    {
                      key: "title",
                      label: "Title",
                      render: (row) => <span className="text-text-primary">{row.title}</span>,
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => getTicketStatusBadge(row.status),
                    },
                  ]}
                />

                <ActivityList
                  title="Announcements"
                  rows={mockData.announcements}
                  emptyText="No announcements available."
                  columns={[
                    {
                      key: "update",
                      label: "Update",
                      render: (row) => <span className="text-text-primary">{row.title}</span>,
                    },
                    {
                      key: "type",
                      label: "Type",
                      render: (row) => getAnnouncementBadge(row.type),
                    },
                  ]}
                />
              </section>

              <section aria-label="Quick actions">
                <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--kcx-card-light)] shadow-sm-custom">
                  <CardContent className="flex flex-col gap-3 p-5 md:flex-row">
                    <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
                      Create Ticket
                    </Button>
                    <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
                      Schedule Support Call
                    </Button>
                    {hasFailedUploads ? (
                      <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
                        Retry Failed Upload
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
