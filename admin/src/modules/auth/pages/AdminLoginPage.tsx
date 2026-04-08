import { useMemo, useState, type FormEvent } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/shared/ui/button"
import kcxLogo from "../../../../../frontend/src/assets/logos/kcx-logo.svg"
import { adminLogin } from "@/modules/auth/admin-auth.api"
import { setAdminToken } from "@/modules/auth/admin-session"

type LocationState = { from?: { pathname?: string } }

export function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const fromPath = useMemo(() => {
    const state = location.state as LocationState | null
    return state?.from?.pathname && state.from.pathname !== "/login" ? state.from.pathname : "/"
  }, [location.state])

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await adminLogin(email, password)
      setAdminToken(result.token)
      navigate(fromPath, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="kcx-admin-surface min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center px-6 py-10">
        <div className="mb-6 flex items-center justify-center gap-3">
          <img src={kcxLogo} alt="KCX logo" className="h-8 w-auto" />
          <div className="text-base font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">KCX Admin</div>
        </div>

        <div className="kcx-admin-card p-7">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-[color:rgba(15,23,42,0.92)]">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the admin credentials configured on the backend.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <div className="text-sm font-medium text-[color:rgba(15,23,42,0.86)]">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-4 py-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                placeholder="admin@example.com"
                required
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium text-[color:rgba(15,23,42,0.86)]">Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white px-4 py-3 text-sm outline-none ring-[color:rgba(47,125,106,0.35)] focus:ring-2"
                placeholder="••••••••"
                required
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
