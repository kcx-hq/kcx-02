import { Navigate, Route, Routes } from "react-router-dom"

import { AdminShell } from "@/components/layout/AdminShell"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { SectionPage } from "@/features/sections/pages/SectionPage"

export function App() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/user" element={<SectionPage title="User" />} />
        <Route path="/billing-uploads" element={<SectionPage title="Billing Uploads" />} />
        <Route path="/issue-management" element={<SectionPage title="Issue Management" />} />
        <Route path="/announcement" element={<SectionPage title="Announcement" />} />
        <Route path="/scheduled-meeting" element={<SectionPage title="Scheduled Meeting" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
