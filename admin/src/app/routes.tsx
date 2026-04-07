import { Navigate, Route, Routes } from "react-router-dom"

import { AdminShell } from "@/layout/AdminShell"
import { BillingUploadsPage } from "@/modules/billing-uploads/pages/BillingUploadsPage"
import { RequireAdminAuth } from "@/modules/auth/components/RequireAdminAuth"
import { AdminLoginPage } from "@/modules/auth/pages/AdminLoginPage"
import { ClientsPage } from "@/modules/clients/pages/ClientsPage"
import { CloudConnectionsPage } from "@/modules/cloud-connections/pages/CloudConnectionsPage"
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage"
import { DemoRequestsPage } from "@/modules/demo-requests/pages/DemoRequestsPage"
import { SectionPage } from "@/modules/sections/pages/SectionPage"

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />

      <Route element={<RequireAdminAuth />}>
        <Route element={<AdminShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/cloud-connections" element={<CloudConnectionsPage />} />
          <Route path="/user" element={<SectionPage title="Users & Roles" />} />
          <Route path="/billing-uploads" element={<BillingUploadsPage />} />
          <Route path="/scheduled-meeting" element={<DemoRequestsPage />} />
          <Route path="/issue-management" element={<SectionPage title="Issue Management" />} />
          <Route path="/announcement" element={<SectionPage title="Announcements" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
