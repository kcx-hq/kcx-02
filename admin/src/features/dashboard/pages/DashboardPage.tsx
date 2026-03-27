import { CalendarClock, Megaphone, Ticket, Upload, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ADMIN_NAV } from "@/lib/nav"
import { KpiCard } from "@/features/dashboard/components/KpiCard"
import { QuickActionCard } from "@/features/dashboard/components/QuickActionCard"
import { SnapshotList } from "@/features/dashboard/components/SnapshotList"

export function DashboardPage() {
  return (
    <div className="space-y-7 lg:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[56rem]">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[1.75rem]">Dashboard</h1>
          <p className="mt-1 text-sm text-text-on-dark-muted">
            A clean operational overview — fast access to workflows, snapshots, and the latest internal updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">New announcement</Button>
          <Button variant="outline">Upload billing</Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open Tickets" value="14" helper="3 waiting on client, 2 escalations" trend="up" />
        <KpiCard label="Upcoming Meetings" value="5" helper="Next: FinOps sync at 4:30 PM" trend="flat" />
        <KpiCard label="Active Users" value="92" helper="8 new invites pending approval" trend="up" />
        <KpiCard label="Billing Uploads" value="7" helper="2 flagged for validation" trend="flat" />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="kcx-admin-card--interactive lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump into high-frequency operational tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickActionCard
                to={ADMIN_NAV[0].to}
                title={ADMIN_NAV[0].label}
                description="Review access, roles, onboarding"
                icon={<Users className="h-5 w-5 text-[color:rgba(172,238,214,0.95)]" aria-hidden="true" />}
              />
              <QuickActionCard
                to={ADMIN_NAV[1].to}
                title={ADMIN_NAV[1].label}
                description="Triage and assign requests"
                icon={<Ticket className="h-5 w-5 text-[color:rgba(172,238,214,0.95)]" aria-hidden="true" />}
              />
              <QuickActionCard
                to={ADMIN_NAV[2].to}
                title={ADMIN_NAV[2].label}
                description="View agenda and attendees"
                icon={<CalendarClock className="h-5 w-5 text-[color:rgba(172,238,214,0.95)]" aria-hidden="true" />}
              />
              <QuickActionCard
                to={ADMIN_NAV[4].to}
                title={ADMIN_NAV[4].label}
                description="Upload and validate artifacts"
                icon={<Upload className="h-5 w-5 text-[color:rgba(172,238,214,0.95)]" aria-hidden="true" />}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="kcx-admin-card--interactive">
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>What needs attention now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="kcx-admin-soft-row">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:rgba(62,138,118,0.14)] ring-1 ring-[color:rgba(118,177,157,0.20)]">
                <Megaphone className="h-5 w-5 text-[color:rgba(172,238,214,0.95)]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Announcement review</div>
                <div className="truncate text-xs text-text-on-dark-muted">Approve Q2 support schedule update</div>
              </div>
            </div>
            <div className="kcx-admin-soft-row">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:rgba(255,255,255,0.03)] ring-1 ring-[color:rgba(255,255,255,0.10)]">
                <Ticket className="h-5 w-5 text-[color:rgba(200,214,224,0.92)]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Ticket triage</div>
                <div className="truncate text-xs text-text-on-dark-muted">2 escalations require assignment</div>
              </div>
            </div>
            <div className="kcx-admin-soft-row">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:rgba(255,255,255,0.03)] ring-1 ring-[color:rgba(255,255,255,0.10)]">
                <Upload className="h-5 w-5 text-[color:rgba(200,214,224,0.92)]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Billing validation</div>
                <div className="truncate text-xs text-text-on-dark-muted">2 uploads flagged for missing tags</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SnapshotList
          title="Recent tickets"
          description="Newest operational requests and their current state."
          rows={[
            { title: "AWS payer access request", meta: "From: Platform Eng · 2h ago", status: { label: "Open", variant: "subtle" } },
            { title: "Cloud account onboarding", meta: "From: Finance Ops · 6h ago", status: { label: "In review", variant: "outline" } },
            { title: "SSO mapping correction", meta: "From: IT · Yesterday", status: { label: "Escalated", variant: "warning" } },
          ]}
        />
        <SnapshotList
          title="Upcoming meetings"
          description="Next internal checkpoints and client calls."
          rows={[
            { title: "FinOps weekly sync", meta: "Today · 4:30 PM IST", status: { label: "Scheduled", variant: "outline" } },
            { title: "Customer escalation review", meta: "Tomorrow · 11:00 AM IST", status: { label: "Prep", variant: "subtle" } },
            { title: "Billing reconciliation", meta: "Fri · 3:00 PM IST", status: { label: "Draft", variant: "outline" } },
          ]}
        />
        <SnapshotList
          title="Announcements"
          description="Latest internal communications and pending drafts."
          rows={[
            { title: "Release notes — March", meta: "Published · 1 day ago", status: { label: "Live", variant: "subtle" } },
            { title: "Support schedule update", meta: "Draft · Needs approval", status: { label: "Draft", variant: "outline" } },
            { title: "Incident postmortem", meta: "Draft · Due tomorrow", status: { label: "Pending", variant: "warning" } },
          ]}
        />
        <SnapshotList
          title="Billing uploads"
          description="Recent uploads and validation outcomes."
          rows={[
            { title: "AWS CUR — Feb 2026", meta: "Uploaded · 2 hours ago", status: { label: "Validated", variant: "subtle" } },
            { title: "Azure invoice — Feb 2026", meta: "Uploaded · Yesterday", status: { label: "Flagged", variant: "warning" } },
            { title: "GCP export — Feb 2026", meta: "Uploaded · 3 days ago", status: { label: "Validated", variant: "subtle" } },
          ]}
        />
      </section>
    </div>
  )
}

