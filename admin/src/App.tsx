import { Navigate, Route, Routes } from "react-router-dom"

import { AdminShell } from "@/components/layout/AdminShell"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { SectionPage } from "@/features/sections/pages/SectionPage"

export function App() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/user" element={<SectionPage title="User" description="Manage users, access, and profile integrity." />} />
        <Route
          path="/ticket-management"
          element={<SectionPage title="Ticket Management" description="Triage, assign, and resolve operational requests." />}
        />
        <Route path="/meeting" element={<SectionPage title="Meeting" description="Coordinate upcoming internal and client sessions." />} />
        <Route
          path="/announcement"
          element={<SectionPage title="Announcement" description="Draft, publish, and audit internal communications." />}
        />
        <Route
          path="/billing-uploads"
          element={<SectionPage title="Billing Uploads" description="Review and upload billing artifacts and reports." />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

