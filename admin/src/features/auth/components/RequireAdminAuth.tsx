import { useEffect, useMemo, useState } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { adminMe } from "@/features/auth/admin-auth.api"
import { clearAdminToken, getAdminToken } from "@/features/auth/admin-session"

export function RequireAdminAuth() {
  const location = useLocation()
  const token = useMemo(() => getAdminToken(), [])
  const [status, setStatus] = useState<"checking" | "authed" | "nope">("checking")

  useEffect(() => {
    if (!token) {
      setStatus("nope")
      return
    }

    let cancelled = false

    adminMe(token)
      .then((result) => {
        if (cancelled) return
        setStatus(result.admin ? "authed" : "nope")
      })
      .catch(() => {
        if (cancelled) return
        clearAdminToken()
        setStatus("nope")
      })

    return () => {
      cancelled = true
    }
  }, [token])

  if (status === "checking") {
    return (
      <div className="kcx-admin-surface grid min-h-screen place-items-center px-6">
        <div className="kcx-admin-card w-full max-w-md p-6 text-sm text-muted-foreground">Checking session…</div>
      </div>
    )
  }

  if (status === "nope") {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

