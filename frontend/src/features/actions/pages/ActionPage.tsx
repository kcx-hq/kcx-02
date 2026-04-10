import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTenantCloudIntegrations } from "@/features/client-home/hooks/useTenantCloudIntegrations"
import { ApiError } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"
import { RefreshCcw } from "lucide-react"

import { runEc2InstanceAction } from "@/features/actions/api/actions.api"
import { InstanceTable } from "@/features/actions/components/InstanceTable"
import { EC2_INSTANCES_QUERY_KEY, useEc2Instances } from "@/features/actions/hooks/useEc2Instances"
import type { AwsActionConnectionOption, Ec2ActionType } from "@/features/actions/types"

type PendingConfirmation = {
  instanceId: string
  action: Ec2ActionType
}

const PRIORITY_CONNECTION_STATUSES = new Set(["active", "active_with_warnings", "awaiting_validation", "connecting"])

function getConnectionIdFromSearch(): string | null {
  if (typeof window === "undefined") return null
  const search = new URLSearchParams(window.location.search)
  const connectionId = search.get("connectionId")
  return connectionId && connectionId.trim() ? connectionId.trim() : null
}

function stateCountByValue(instances: Array<{ state: string | null }>) {
  return instances.reduce<Record<string, number>>((accumulator, instance) => {
    const key = String(instance.state ?? "unknown").trim().toLowerCase() || "unknown"
    accumulator[key] = (accumulator[key] ?? 0) + 1
    return accumulator
  }, {})
}

function toConnectionStatusLabel(status: string) {
  if (status === "active") return "Healthy"
  if (status === "active_with_warnings") return "Warning"
  if (status === "awaiting_validation") return "Pending"
  if (status === "connecting") return "Connecting"
  if (status === "failed") return "Failed"
  if (status === "suspended") return "Suspended"
  return "Draft"
}

export function ActionPage() {
  const queryClient = useQueryClient()
  const {
    data: cloudIntegrations = [],
    isLoading: integrationsLoading,
    isError: integrationsError,
    error: integrationsLoadError,
    refetch: refetchIntegrations,
  } = useTenantCloudIntegrations(true)

  const awsConnections = useMemo<AwsActionConnectionOption[]>(() => {
    return cloudIntegrations
      .filter(
        (row) =>
          row.provider?.code === "aws" &&
          row.detail_record_id &&
          row.detail_record_type === "automatic_cloud_connection",
      )
      .map((row) => ({
        integrationId: row.id,
        connectionId: row.detail_record_id,
        displayName: row.display_name,
        cloudAccountId: row.cloud_account_id,
        status: row.status,
      }))
  }, [cloudIntegrations])

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [pendingActionByInstanceId, setPendingActionByInstanceId] = useState<Record<string, Ec2ActionType | null>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)

  useEffect(() => {
    if (awsConnections.length === 0) {
      setSelectedConnectionId(null)
      return
    }

    const fromSearch = getConnectionIdFromSearch()
    if (fromSearch && awsConnections.some((connection) => connection.connectionId === fromSearch)) {
      setSelectedConnectionId(fromSearch)
      return
    }

    const prioritizedConnection =
      awsConnections.find((connection) => PRIORITY_CONNECTION_STATUSES.has(connection.status)) ?? awsConnections[0]

    setSelectedConnectionId((currentValue) => {
      if (currentValue && awsConnections.some((connection) => connection.connectionId === currentValue)) {
        return currentValue
      }
      return prioritizedConnection.connectionId
    })
  }, [awsConnections])

  useEffect(() => {
    if (!selectedConnectionId || typeof window === "undefined") return
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set("connectionId", selectedConnectionId)
    window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}`)
  }, [selectedConnectionId])

  const selectedConnection = useMemo(
    () => awsConnections.find((connection) => connection.connectionId === selectedConnectionId) ?? null,
    [awsConnections, selectedConnectionId],
  )

  const {
    data: instances = [],
    isLoading: instancesLoading,
    isFetching: instancesFetching,
    isError: instancesError,
    error: instancesLoadError,
    refetch: refetchInstances,
  } = useEc2Instances(selectedConnectionId)

  const stateCounts = useMemo(() => stateCountByValue(instances), [instances])
  const totalInstances = instances.length
  const runningInstances = stateCounts.running ?? 0
  const stoppedInstances = stateCounts.stopped ?? 0

  const integrationErrorMessage =
    integrationsLoadError instanceof ApiError
      ? integrationsLoadError.message
      : "Unable to load AWS cloud integrations."

  const extractApiReason = (error: ApiError): string | null => {
    if (!error.payload || typeof error.payload !== "object") return null
    const payload = error.payload as {
      error?: {
        details?: {
          reason?: unknown
        }
      }
    }
    const reason = payload.error?.details?.reason
    return typeof reason === "string" && reason.trim() ? reason.trim() : null
  }

  const instanceErrorMessage =
    instancesLoadError instanceof ApiError
      ? extractApiReason(instancesLoadError) ?? instancesLoadError.message
      : "Unable to load EC2 instances."

  async function runAction(instanceId: string, action: Ec2ActionType) {
    if (!selectedConnectionId) return

    setErrorMessage(null)
    setSuccessMessage(null)
    setPendingActionByInstanceId((currentValue) => ({
      ...currentValue,
      [instanceId]: action,
    }))

    try {
      const result = await runEc2InstanceAction(action, {
        connectionId: selectedConnectionId,
        instanceId,
      })

      setSuccessMessage(result.message || `Instance ${action} initiated.`)

      await queryClient.invalidateQueries({
        queryKey: [...EC2_INSTANCES_QUERY_KEY, selectedConnectionId],
      })
      await refetchInstances()
    } catch (error) {
      if (error instanceof ApiError) {
        const reason = extractApiReason(error)
        setErrorMessage(reason ?? error.message ?? `Failed to ${action} instance.`)
      } else if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(`Failed to ${action} instance.`)
      }
    } finally {
      setPendingActionByInstanceId((currentValue) => ({
        ...currentValue,
        [instanceId]: null,
      }))
    }
  }

  function handleActionClick(instanceId: string, action: Ec2ActionType) {
    if (action === "stop" || action === "reboot") {
      setPendingConfirmation({ instanceId, action })
      return
    }

    void runAction(instanceId, action)
  }

  function handleConfirmAction() {
    if (!pendingConfirmation) return
    const { instanceId, action } = pendingConfirmation
    setPendingConfirmation(null)
    void runAction(instanceId, action)
  }

  const hasAwsConnection = awsConnections.length > 0

  return (
    <>
      <section aria-label="Action header" className="space-y-2">
        <p className="kcx-eyebrow text-brand-primary">Action Center</p>
        <h1 className="kcx-heading text-2xl font-semibold tracking-tight text-text-primary">EC2 Actions</h1>
        <p className="max-w-3xl text-sm text-text-secondary">
          Manage instance operations for connected AWS accounts. Start, stop, and reboot EC2 instances with tenant-scoped controls.
        </p>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-text-primary">Connection Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {integrationsLoading ? <p className="text-sm text-text-secondary">Loading AWS connection context...</p> : null}

          {integrationsError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-rose-600">{integrationErrorMessage}</p>
              <Button variant="outline" size="sm" className="h-8 rounded-md" onClick={() => void refetchIntegrations()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!integrationsLoading && !integrationsError && !hasAwsConnection ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">No AWS connection found yet. Connect an AWS account before running EC2 actions.</p>
              <Button className="h-9 rounded-md" onClick={() => navigateTo("/client/billing/connect-cloud/add/aws")}>
                Connect AWS
              </Button>
            </div>
          ) : null}

          {!integrationsLoading && !integrationsError && hasAwsConnection ? (
            <div className="grid gap-3 md:grid-cols-[minmax(0,340px)_1fr] md:items-center">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Active AWS Connection</span>
                <select
                  value={selectedConnectionId ?? ""}
                  onChange={(event) => setSelectedConnectionId(event.target.value || null)}
                  className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                >
                  {awsConnections.map((connection) => (
                    <option key={connection.connectionId} value={connection.connectionId}>
                      {connection.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                <span>Connection ID: <span className="font-mono text-xs text-text-primary">{selectedConnection?.connectionId ?? "-"}</span></span>
                <span>Account: <span className="text-text-primary">{selectedConnection?.cloudAccountId ?? "-"}</span></span>
                <Badge
                  variant="outline"
                  className="rounded-md border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
                >
                  {toConnectionStatusLabel(selectedConnection?.status ?? "draft")}
                </Badge>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selectedConnectionId ? (
        <>
          <section className="grid gap-3 md:grid-cols-3" aria-label="Instance summary cards">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Instances</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{totalInstances}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Running</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{runningInstances}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Stopped</p>
                <p className="mt-2 text-2xl font-semibold text-slate-700">{stoppedInstances}</p>
              </CardContent>
            </Card>
          </section>

          <section className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-text-primary">EC2 Instance Inventory</h2>
                  <p className="text-sm text-text-secondary">
                    Live instance state for the selected connection.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-9 rounded-md"
                  onClick={() => {
                    setErrorMessage(null)
                    setSuccessMessage(null)
                    void refetchInstances()
                  }}
                  disabled={instancesFetching}
                >
                  <RefreshCcw className={`mr-2 h-4 w-4 ${instancesFetching ? "animate-spin" : ""}`} />
                  {instancesFetching ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              {successMessage ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}

              {instancesLoading ? (
                <div className="space-y-2 rounded-md border border-[color:var(--border-light)] bg-white p-4">
                  <div className="h-10 animate-pulse rounded-md bg-[color:var(--bg-surface)]" />
                  <div className="h-10 animate-pulse rounded-md bg-[color:var(--bg-surface)]" />
                  <div className="h-10 animate-pulse rounded-md bg-[color:var(--bg-surface)]" />
                </div>
              ) : instancesError ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm text-rose-700">{instanceErrorMessage}</p>
                  <Button variant="outline" size="sm" className="h-8 rounded-md" onClick={() => void refetchInstances()}>
                    Retry
                  </Button>
                </div>
              ) : instances.length === 0 ? (
                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-8 text-center">
                  <h3 className="text-base font-semibold text-text-primary">No EC2 instances found</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    This AWS connection currently has no discoverable EC2 instances in the configured region.
                  </p>
                  <Button variant="outline" className="mt-4 h-9 rounded-md" onClick={() => void refetchInstances()}>
                    Refresh list
                  </Button>
                </div>
              ) : (
                <InstanceTable
                  instances={instances}
                  pendingActionByInstanceId={pendingActionByInstanceId}
                  onActionClick={handleActionClick}
                />
              )}
            </div>
          </section>
        </>
      ) : null}

      <Dialog open={Boolean(pendingConfirmation)} onOpenChange={(open) => (!open ? setPendingConfirmation(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Instance Action</DialogTitle>
            <DialogDescription>
              {pendingConfirmation?.action === "stop"
                ? "Stop will gracefully halt this instance. You can start it again later."
                : "Reboot will restart this instance. Running sessions may be interrupted."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" className="h-9 rounded-md" onClick={() => setPendingConfirmation(null)}>
              Cancel
            </Button>
            <Button className="h-9 rounded-md" onClick={handleConfirmAction}>
              Confirm {pendingConfirmation?.action ?? "action"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ActionPage
