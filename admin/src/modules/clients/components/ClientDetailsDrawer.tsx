import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import type { AdminClientV1 } from "@/modules/clients/admin-clients.api"
import { deriveClientOperationalSummary, type ClientOperationalState } from "@/modules/clients/client-operational-summary"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"

function formatValue(value: string | null | undefined): string {
  if (value === null || typeof value === "undefined" || value.trim() === "") return "-"
  return value
}

function statusVariant(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === "ACTIVE") return "subtle" as const
  if (normalized === "BLOCKED") return "warning" as const
  return "outline" as const
}

function operationalStateBadgeVariant(state: ClientOperationalState) {
  if (state === "Operational") return "subtle" as const
  if (state === "Needs Attention" || state === "No Data Flow") return "warning" as const
  return "outline" as const
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="text-[color:rgba(15,23,42,0.60)]">{label}</div>
      <div className="break-all text-[color:rgba(15,23,42,0.88)]">{value}</div>
    </div>
  )
}

function formatMemberSince(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)

  return `${datePart}, ${timePart}`
}

type ClientDetailsDrawerProps = {
  open: boolean
  client: AdminClientV1 | null
  onOpenChange: (open: boolean) => void
}

export function ClientDetailsDrawer({ open, client, onOpenChange }: ClientDetailsDrawerProps) {
  const summary = client ? deriveClientOperationalSummary(client) : null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[820px] overflow-y-auto bg-white p-5 shadow-[-18px_0_48px_-30px_rgba(15,23,42,0.55)] outline-none sm:p-6">
          <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-3 border-b border-[color:rgba(15,23,42,0.08)] bg-white pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">
                Client Details
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Client ID: {client?.id ?? "-"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close details">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          {client ? (
            <div className="space-y-5 pb-6">
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">Operational Overview</div>
                  <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
                    <div className="text-[color:rgba(15,23,42,0.60)]">Operational State</div>
                    <div>
                      <Badge variant={summary ? operationalStateBadgeVariant(summary.state) : "outline"}>
                        {summary?.state ?? "-"}
                      </Badge>
                    </div>
                  </div>
                  <DetailRow label="Primary Reason" value={summary?.primaryReason ?? "-"} />
                  <DetailRow label="Recommended Action" value={summary?.recommendedAction ?? "-"} />
                  <DetailRow label="Last Successful Activity" value={formatMemberSince(summary?.lastActivity ?? null)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">Cloud & Billing Snapshot</div>
                  <DetailRow label="Cloud Connection" value={summary?.cloudStatus ?? "-"} />
                  <DetailRow label="Setup Type" value={summary?.setupType ?? "-"} />
                  <DetailRow label="Billing/Data" value={summary?.dataStatus ?? "-"} />
                  <DetailRow label="Latest Run" value={summary?.latestRun ?? "-"} />
                  <DetailRow label="Total Files" value={String(summary?.totalFiles ?? 0)} />
                  <DetailRow label="Uploaded Files" value={String(summary?.uploadedFiles ?? 0)} />
                  <DetailRow label="Processed Files" value={String(summary?.processedFiles ?? 0)} />
                  <DetailRow label="Ingested Files" value={String(summary?.ingestedFiles ?? 0)} />
                  {summary?.latestFile ? <DetailRow label="Latest File" value={summary.latestFile} /> : null}
                  {summary?.cloudAccountId ? <DetailRow label="Cloud Account ID" value={summary.cloudAccountId} /> : null}
                </CardContent>
              </Card>

              {summary && summary.state !== "Operational" && summary.issues.length > 0 ? (
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">Issues Requiring Attention</div>
                    {summary.issues.map((item, index) => (
                      <div
                        key={`${item.problemArea}-${index}`}
                        className="space-y-1 rounded-lg border border-[color:rgba(15,23,42,0.08)] px-3 py-2 text-sm"
                      >
                        <DetailRow label="Problem Area" value={item.problemArea} />
                        <DetailRow label="Error Summary" value={item.errorSummary} />
                        {item.failedRows !== null ? <DetailRow label="Failed Rows" value={String(item.failedRows)} /> : null}
                        {item.lastFailureTime ? (
                          <DetailRow label="Last Failure Time" value={formatMemberSince(item.lastFailureTime)} />
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.88)]">Client Context</div>
                  <DetailRow label="Full Name" value={formatValue(client.fullName)} />
                  <DetailRow label="Email" value={formatValue(client.email)} />
                  <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
                    <div className="text-[color:rgba(15,23,42,0.60)]">Role</div>
                    <div>
                      <Badge variant="outline">{formatValue(client.role)}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
                    <div className="text-[color:rgba(15,23,42,0.60)]">Client Status</div>
                    <div>
                      <Badge variant={statusVariant(client.status)}>{formatValue(client.status)}</Badge>
                    </div>
                  </div>
                  <DetailRow label="Company Name" value={formatValue(client.tenant.name)} />
                  <DetailRow label="Member Since" value={formatMemberSince(client.createdAt)} />
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-xl border border-[color:rgba(15,23,42,0.08)] bg-[color:rgba(15,23,42,0.02)] px-4 py-3 text-sm text-muted-foreground">
              Select a client from the table to view details.
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
