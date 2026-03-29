import { Navigate, Route, Routes } from "react-router-dom"

import { AdminShell } from "@/components/layout/AdminShell"
import { RequireAdminAuth } from "@/features/auth/components/RequireAdminAuth"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { ClientsPage } from "@/features/clients/pages/ClientsPage"
import { DemoRequestsPage } from "@/features/demo-requests/pages/DemoRequestsPage"
import { SectionPage } from "@/features/sections/pages/SectionPage"
import { AdminLoginPage } from "@/features/auth/pages/AdminLoginPage"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />

      <Route element={<RequireAdminAuth />}>
          <Route element={<AdminShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/cloud-connections" element={<SectionPage title="Cloud Connections" />} />
          <Route path="/user" element={<SectionPage title="Users & Roles" />} />
          <Route path="/billing-uploads" element={<SectionPage title="Billing Uploads" />} />
          <Route path="/scheduled-meeting" element={<DemoRequestsPage />} />
          <Route path="/issue-management" element={<SectionPage title="Issue Management" />} />
          <Route path="/announcement" element={<SectionPage title="Announcements" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
