import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ApiError, apiGet } from "@/lib/api"

export type IngestionTerminalStatus = "completed" | "completed_with_warnings" | "failed"

export type IngestionStatusCode =
  | "queued"
  | "validating_schema"
  | "reading_rows"
  | "normalizing"
  | "upserting_dimensions"
  | "inserting_facts"
  | "finalizing"
  | IngestionTerminalStatus

export type IngestionStatusPayload = {
  id: string
  status: IngestionStatusCode
  currentStep: IngestionStatusCode | null
  progressPercent: number
  statusMessage: string | null
  rowsRead: number
  rowsLoaded: number
  rowsFailed: number
  totalRowsEstimated: number | null
  startedAt: string | null
  finishedAt: string | null
  errorMessage: string | null
  lastUpdatedAt: string
  lastHeartbeatAt: string | null
}

type UseIngestionStatusOptions = {
  ingestionRunId: string | null
  enabled?: boolean
}

export function useIngestionStatus({ ingestionRunId, enabled = true }: UseIngestionStatusOptions) {
  const [status, setStatus] = useState<IngestionStatusPayload | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  const timeoutRef = useRef<number | null>(null)
  const pollStartedAtRef = useRef<number | null>(null)
  const unmountedRef = useRef(false)
  const pollSessionIdRef = useRef(0)

  const clearScheduledPoll = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const isTerminal =
    status?.status === "completed" ||
    status?.status === "completed_with_warnings" ||
    status?.status === "failed"
  const isRunning = Boolean(status && !isTerminal)

  const poll = useCallback(async () => {
    if (!ingestionRunId || !enabled || unmountedRef.current) return

    const sessionId = pollSessionIdRef.current

    if (!pollStartedAtRef.current) {
      pollStartedAtRef.current = Date.now()
    }

    try {
      setIsPolling(true)
      const nextStatus = await apiGet<IngestionStatusPayload>(`/billing/ingestions/${ingestionRunId}/status`)
      if (unmountedRef.current || sessionId !== pollSessionIdRef.current) return

      setStatus(nextStatus)
      setRequestError(null)

      if (
        nextStatus.status === "completed" ||
        nextStatus.status === "completed_with_warnings" ||
        nextStatus.status === "failed"
      ) {
        clearScheduledPoll()
        return
      }

      const elapsedMs = Date.now() - pollStartedAtRef.current
      const nextDelay = elapsedMs < 30_000 ? 2_000 : 5_000
      timeoutRef.current = window.setTimeout(() => {
        if (sessionId !== pollSessionIdRef.current || unmountedRef.current) return
        void poll()
      }, nextDelay)
    } catch (error) {
      if (unmountedRef.current || sessionId !== pollSessionIdRef.current) return

      if (error instanceof ApiError) {
        setRequestError(error.message || "Failed to fetch ingestion status")
      } else {
        setRequestError("Failed to fetch ingestion status")
      }
      timeoutRef.current = window.setTimeout(() => {
        if (sessionId !== pollSessionIdRef.current || unmountedRef.current) return
        void poll()
      }, 5_000)
    } finally {
      if (!unmountedRef.current && sessionId === pollSessionIdRef.current) {
        setIsPolling(false)
      }
    }
  }, [clearScheduledPoll, enabled, ingestionRunId])

  useEffect(() => {
    unmountedRef.current = false
    pollSessionIdRef.current += 1
    clearScheduledPoll()
    pollStartedAtRef.current = null

    if (!ingestionRunId || !enabled) {
      setStatus(null)
      setRequestError(null)
      return () => {
        unmountedRef.current = true
      }
    }

    void poll()

    return () => {
      unmountedRef.current = true
      clearScheduledPoll()
    }
  }, [clearScheduledPoll, enabled, ingestionRunId, poll])

  const progress = useMemo(() => {
    if (!status) return 0
    return Math.max(0, Math.min(100, Math.round(status.progressPercent)))
  }, [status])

  return {
    status,
    progress,
    isPolling,
    isRunning,
    isTerminal,
    requestError,
    refresh: poll,
    clearScheduledPoll,
  }
}
