import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { BillingUploadsSection } from "@/features/client-home/components/billing/BillingUploadsSection"
import { IngestionDetailsDialog } from "@/features/client-home/components/billing/IngestionDetailsDialog"
import { ManualBillingUploadDialog } from "@/features/client-home/components/ManualBillingUploadDialog"
import {
  ACTIVE_INGESTION_STORAGE_KEY,
  normalizeUploadStatusLabel,
} from "@/features/client-home/components/billing/billingHelpers"
import { useIngestionStatus, type IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"
import {
  TENANT_UPLOAD_HISTORY_QUERY_KEY,
  useTenantUploadHistory,
} from "@/features/client-home/hooks/useTenantUploadHistory"
import { useUploadHistorySelectionStore } from "@/features/client-home/stores/uploadHistorySelection.store"
import { ApiError, apiGet } from "@/lib/api"

export function ClientBillingUploadHistoryPage() {
  const queryClient = useQueryClient()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  const [activeIngestionRunId, setActiveIngestionRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(ACTIVE_INGESTION_STORAGE_KEY)
  })
  const [latestActiveIngestionLoaded, setLatestActiveIngestionLoaded] = useState(false)
  const [lastTerminalIngestionStatus, setLastTerminalIngestionStatus] = useState<IngestionStatusPayload | null>(null)

  const { status: ingestionStatus } = useIngestionStatus({
    ingestionRunId: activeIngestionRunId,
    enabled: Boolean(activeIngestionRunId),
    onIngestionRunNotFound: () => {
      setActiveIngestionRunId(null)
      window.localStorage.removeItem(ACTIVE_INGESTION_STORAGE_KEY)
    },
  })

  const displayIngestionStatus = ingestionStatus ?? lastTerminalIngestionStatus

  const {
    data: uploadHistoryRecords = [],
    isLoading: isUploadHistoryLoading,
    isError: isUploadHistoryError,
    error: uploadHistoryError,
    refetch: refetchUploadHistory,
  } = useTenantUploadHistory(true)

  const [dashboardActionLoading, setDashboardActionLoading] = useState(false)
  const [dashboardActionError, setDashboardActionError] = useState<string | null>(null)

  const retainOnlyFiles = useUploadHistorySelectionStore((state) => state.retainOnlyFiles)
  const clearSelectedFiles = useUploadHistorySelectionStore((state) => state.clearSelectedFiles)

  const uploadHistoryErrorMessage =
    uploadHistoryError instanceof ApiError ? uploadHistoryError.message : "Failed to load upload history"

  const [detailsRunId, setDetailsRunId] = useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [detailsStatus, setDetailsStatus] = useState<IngestionStatusPayload | null>(null)

  const compactStatusLabel = useMemo(() => {
    if (displayIngestionStatus?.status) {
      return normalizeUploadStatusLabel(displayIngestionStatus.status)
    }
    const latestStatus = uploadHistoryRecords[0]?.status
    return normalizeUploadStatusLabel(latestStatus)
  }, [displayIngestionStatus, uploadHistoryRecords])

  useEffect(() => {
    if (latestActiveIngestionLoaded || activeIngestionRunId) return

    void (async () => {
      try {
        const latestActive = await apiGet<IngestionStatusPayload | null>("/billing/ingestions/latest-active")
        if (latestActive?.id) {
          setActiveIngestionRunId(latestActive.id)
          setLastTerminalIngestionStatus(null)
          window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, latestActive.id)
        }
      } catch {
        // Best-effort recovery for reload path.
      } finally {
        setLatestActiveIngestionLoaded(true)
      }
    })()
  }, [activeIngestionRunId, latestActiveIngestionLoaded])

  useEffect(() => {
    if (!ingestionStatus) return

    const isTerminalStatus =
      ingestionStatus.status === "completed" ||
      ingestionStatus.status === "completed_with_warnings" ||
      ingestionStatus.status === "failed"

    if (isTerminalStatus) {
      setLastTerminalIngestionStatus(ingestionStatus)
      if (activeIngestionRunId) {
        window.localStorage.removeItem(ACTIVE_INGESTION_STORAGE_KEY)
        setActiveIngestionRunId(null)
      }
      return
    }

    if (activeIngestionRunId && window.localStorage.getItem(ACTIVE_INGESTION_STORAGE_KEY) !== activeIngestionRunId) {
      window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, activeIngestionRunId)
    }
  }, [activeIngestionRunId, ingestionStatus])

  useEffect(() => {
    const availableRawBillingFileIds = uploadHistoryRecords
      .map((record) => Number(record.rawBillingFileId))
      .filter((rawBillingFileId) => Number.isInteger(rawBillingFileId))
    retainOnlyFiles(availableRawBillingFileIds)
  }, [retainOnlyFiles, uploadHistoryRecords])

  useEffect(() => {
    return () => {
      clearSelectedFiles()
      setDashboardActionError(null)
    }
  }, [clearSelectedFiles])

  function handleIngestionQueued(payload: { ingestionRunId: string }) {
    setLastTerminalIngestionStatus(null)
    setActiveIngestionRunId(payload.ingestionRunId)
    window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, payload.ingestionRunId)
    void queryClient.invalidateQueries({ queryKey: TENANT_UPLOAD_HISTORY_QUERY_KEY })
  }

  function handleRetryUploadRecord(_record: TenantUploadHistoryRecord) {
    setUploadDialogOpen(true)
  }

  function handleViewUploadDetails(runId: string) {
    setDetailsRunId(runId)
    setDetailsDialogOpen(true)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsStatus(null)

    void (async () => {
      try {
        const status = await apiGet<IngestionStatusPayload>(`/billing/ingestions/${runId}/status`)
        setDetailsStatus(status)
      } catch (error) {
        if (error instanceof ApiError) {
          setDetailsError(error.message || "Failed to load ingestion details")
        } else {
          setDetailsError("Failed to load ingestion details")
        }
      } finally {
        setDetailsLoading(false)
      }
    })()
  }

  function openDashboardWithQuery(search: URLSearchParams) {
    const nextUrl = `/uploads-dashboard/overview?${search.toString()}`
    window.history.pushState({}, "", nextUrl)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  function handleOpenDashboard(selectedRawBillingFileIds: number[]) {
    if (dashboardActionLoading) return

    const validRawBillingFileIds = [...new Set(selectedRawBillingFileIds.filter((id) => Number.isInteger(id)))]
    if (validRawBillingFileIds.length === 0) {
      setDashboardActionError("Select at least one uploaded file to open dashboard.")
      return
    }

    setDashboardActionError(null)
    setDashboardActionLoading(true)

    void (async () => {
      try {
        const query = new URLSearchParams({
          rawBillingFileIds: validRawBillingFileIds.join(","),
        })
        openDashboardWithQuery(query)
      } catch (error) {
        if (error instanceof ApiError) {
          setDashboardActionError(error.message || "Unable to resolve upload scope for dashboard.")
        } else {
          setDashboardActionError("Unable to resolve upload scope for dashboard.")
        }
      } finally {
        setDashboardActionLoading(false)
      }
    })()
  }

  return (
    <>
      <BillingUploadsSection
        compactStatusLabel={compactStatusLabel}
        uploadHistoryRecords={uploadHistoryRecords}
        isUploadHistoryLoading={isUploadHistoryLoading}
        isUploadHistoryError={isUploadHistoryError}
        uploadHistoryErrorMessage={uploadHistoryErrorMessage}
        dashboardActionError={dashboardActionError}
        dashboardActionLoading={dashboardActionLoading}
        onChooseSource={() => setUploadDialogOpen(true)}
        onRetryUploadHistory={() => {
          void refetchUploadHistory()
        }}
        onViewUploadDetails={handleViewUploadDetails}
        onRetryUploadRecord={handleRetryUploadRecord}
        onOpenDashboard={handleOpenDashboard}
      />

      <IngestionDetailsDialog
        open={detailsDialogOpen}
        detailsRunId={detailsRunId}
        detailsLoading={detailsLoading}
        detailsError={detailsError}
        detailsStatus={detailsStatus}
        onOpenChange={setDetailsDialogOpen}
        onRetry={handleViewUploadDetails}
      />

      <ManualBillingUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onIngestionQueued={handleIngestionQueued}
      />
    </>
  )
}
