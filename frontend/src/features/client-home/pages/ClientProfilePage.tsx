import { useState } from "react"

import { getAuthUser } from "@/lib/auth"

export function ClientProfilePage() {
  const user = getAuthUser()
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true)
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "User"

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(56,108,92,0.9)]">User Settings</p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-text-primary">Profile</h1>
        <p className="text-sm text-[rgba(39,63,57,0.74)]">Manage your personal notification preferences.</p>
      </header>

      <div className="rounded-md border border-[rgba(134,157,149,0.34)] bg-white p-5 shadow-[0_8px_20px_rgba(11,24,23,0.04)]">
        <div className="mb-5 border-b border-[rgba(134,157,149,0.22)] pb-4">
          <p className="text-base font-semibold text-text-primary">{fullName}</p>
          <p className="text-sm text-[rgba(43,67,61,0.76)]">{user?.email ?? "no-email@kcx.local"}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Email Notifications</p>
            <p className="text-xs text-[rgba(43,67,61,0.72)]">Receive workflow and support updates on your email.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailAlertsEnabled}
            onClick={() => setEmailAlertsEnabled((enabled) => !enabled)}
            className={`relative h-6 w-11 rounded-full border border-[rgba(117,145,136,0.5)] p-0.5 transition-colors ${
              emailAlertsEnabled ? "bg-[#3E8A76]" : "bg-[rgba(210,222,218,0.62)]"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${emailAlertsEnabled ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>
    </section>
  )
}
