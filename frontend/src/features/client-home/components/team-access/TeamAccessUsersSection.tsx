import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, ShieldCheck, SlidersHorizontal, UserCheck, UserPlus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  approveOrganizationUser,
  fetchOrganizationUsers,
  inviteOrganizationUser,
  updateOrganizationUserStatus,
  type OrganizationUser,
} from "@/features/client-home/api/organization-users.api"
import { ApiError } from "@/lib/api"
import { getAuthUser } from "@/lib/auth"
import { cn } from "@/lib/utils"

const ORGANIZATION_USERS_QUERY_KEY = ["client-home", "organization-users"] as const

function formatDateTime(value: string | null): string {
  if (!value) return "-"
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return "-"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed))
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "inactive") return "border-slate-300 bg-slate-100 text-slate-700"
  if (status === "invited") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "pending_approval") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function roleBadgeClass(role: string): string {
  if (role === "admin") return "border-violet-200 bg-violet-50 text-violet-700"
  return "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary"
}

function getEmailDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  const atIndex = trimmed.lastIndexOf("@")
  if (atIndex < 1 || atIndex === trimmed.length - 1) return null
  return trimmed.slice(atIndex + 1)
}

export function TeamAccessUsersSection() {
  const queryClient = useQueryClient()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive" | "invited" | "pending_approval">("ALL")
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    role: "member" as "member" | "admin",
  })
  const [inviteErrors, setInviteErrors] = useState<{
    fullName?: string
    email?: string
  }>({})

  const usersQuery = useQuery<OrganizationUser[]>({
    queryKey: ORGANIZATION_USERS_QUERY_KEY,
    queryFn: fetchOrganizationUsers,
  })

  const inviteMutation = useMutation({
    mutationFn: inviteOrganizationUser,
    onSuccess: async () => {
      setNotice("Invitation sent successfully.")
      setInviteDialogOpen(false)
      setInviteForm({ fullName: "", email: "", role: "member" })
      await queryClient.invalidateQueries({ queryKey: ORGANIZATION_USERS_QUERY_KEY })
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : "Could not invite user.")
    },
  })

  const approveMutation = useMutation({
    mutationFn: approveOrganizationUser,
    onSuccess: async () => {
      setNotice("User approved successfully.")
      await queryClient.invalidateQueries({ queryKey: ORGANIZATION_USERS_QUERY_KEY })
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : "Could not approve user.")
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "inactive" }) =>
      updateOrganizationUserStatus(userId, status),
    onSuccess: async (_, variables) => {
      setNotice(variables.status === "active" ? "User activated successfully." : "User deactivated successfully.")
      await queryClient.invalidateQueries({ queryKey: ORGANIZATION_USERS_QUERY_KEY })
    },
    onError: (error) => {
      setNotice(error instanceof ApiError ? error.message : "Could not update user status.")
    },
  })

  const users = usersQuery.data ?? []
  const companyDomain = useMemo(() => {
    const authUserDomain = getEmailDomain(getAuthUser()?.email ?? "")
    if (authUserDomain) return authUserDomain

    const primaryAdminDomain = users.find((user) => user.isPrimaryAdmin)
    return getEmailDomain(primaryAdminDomain?.email ?? "")
  }, [users])

  const counts = useMemo(() => {
    let active = 0
    let pending = 0
    for (const user of users) {
      if (user.status === "active") active += 1
      if (user.status === "invited" || user.status === "pending_approval") pending += 1
    }
    return {
      total: users.length,
      active,
      pending,
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return users.filter((user) => {
      const statusMatches = statusFilter === "ALL" || user.status === statusFilter
      if (!statusMatches) return false
      if (!query) return true
      const searchable = `${user.fullName} ${user.email} ${user.role} ${user.status}`.toLowerCase()
      return searchable.includes(query)
    })
  }, [users, searchQuery, statusFilter])

  function onInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fullName = inviteForm.fullName.trim()
    const email = inviteForm.email.trim().toLowerCase()
    const nextErrors: { fullName?: string; email?: string } = {}

    if (!fullName) {
      nextErrors.fullName = "Full name is required."
    } else if (fullName.length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters."
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email) {
      nextErrors.email = "Work email is required."
    } else if (!emailRegex.test(email)) {
      nextErrors.email = "Please enter a valid work email."
    }

    const inviteDomain = getEmailDomain(email)
    if (!nextErrors.email && companyDomain && inviteDomain !== companyDomain) {
      nextErrors.email = `Only company work emails are allowed (@${companyDomain}).`
    }

    if (nextErrors.fullName || nextErrors.email) {
      setInviteErrors(nextErrors)
      setNotice(null)
      return
    }

    setInviteErrors({})
    inviteMutation.mutate({
      fullName,
      email,
      role: inviteForm.role,
    })
  }

  return (
    <section aria-label="Users management" className="space-y-4">
      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
        <div className="grid grid-cols-1 border-b border-[color:var(--border-light)] md:grid-cols-3">
          <div className="min-h-[108px] px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Users</p>
                <p className="mt-3 text-[2rem] font-semibold leading-none text-text-primary">{counts.total}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <Users className="h-4.5 w-4.5" />
              </span>
            </div>
          </div>
          <div className="min-h-[108px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Active Users</p>
                <p className="mt-3 text-[2rem] font-semibold leading-none text-text-primary">{counts.active}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <UserCheck className="h-4.5 w-4.5" />
              </span>
            </div>
          </div>
          <div className="min-h-[108px] border-t border-[color:var(--border-light)] px-6 py-4 md:border-l md:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Pending Access</p>
                <p className="mt-3 text-[2rem] font-semibold leading-none text-text-primary">{counts.pending}</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <ShieldCheck className="h-4.5 w-4.5" />
              </span>
            </div>
          </div>
        </div>
        <CardContent className="space-y-2 pt-3">
          <div className="mt-0 flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full flex-1 flex-wrap items-center gap-3">
              <div className="relative w-full max-w-[22rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search users..."
                className="h-9 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] pl-9 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              />
              </div>

              <div className="relative min-w-[11rem]">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "ALL" | "active" | "inactive" | "invited" | "pending_approval")
                  }
                  className="h-9 min-w-[11rem] rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] pl-9 pr-3 text-sm text-text-primary outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="invited">Invited</option>
                  <option value="pending_approval">Pending Approval</option>
                </select>
              </div>
            </div>

            <Button className="h-9 rounded-md" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Invite User
            </Button>
          </div>

          {notice ? (
            <div
              role="status"
              className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-text-secondary"
            >
              {notice}
            </div>
          ) : null}

          {usersQuery.isLoading ? (
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-3 text-sm text-text-secondary">
              Loading organization users...
            </div>
          ) : null}

          {usersQuery.isError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {(usersQuery.error as Error)?.message ?? "Could not load organization users."}
            </div>
          ) : null}

          {!usersQuery.isLoading && !usersQuery.isError ? (
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="border-b border-[color:var(--border-light)] bg-transparent hover:bg-transparent">
                  <TableHead className="py-4">Name</TableHead>
                  <TableHead className="py-4">Email</TableHead>
                  <TableHead className="py-4">Role</TableHead>
                  <TableHead className="py-4">Status</TableHead>
                  <TableHead className="py-4">Invited</TableHead>
                  <TableHead className="py-4">Approved</TableHead>
                  <TableHead className="py-4 text-right tracking-[0.14em]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow className="border-b border-[color:var(--border-light)]">
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-text-secondary">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-b border-[color:var(--border-light)] hover:bg-transparent">
                      <TableCell className="py-6 font-medium text-text-primary">
                        {user.fullName}
                        {user.isPrimaryAdmin ? (
                          <span className="ml-2 text-xs font-medium text-[rgba(62,138,118,0.95)]">(Primary Admin)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-6">{user.email}</TableCell>
                      <TableCell className="py-6">
                        <Badge variant="outline" className={cn("rounded-md", roleBadgeClass(user.role))}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6">
                        <Badge variant="outline" className={cn("rounded-md", statusBadgeClass(user.status))}>
                          {user.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6">{formatDateTime(user.invitedAt)}</TableCell>
                      <TableCell className="py-6">{formatDateTime(user.approvedAt)}</TableCell>
                      <TableCell className="py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {(user.status === "invited" || user.status === "pending_approval") ? (
                            <Button
                              variant="outline"
                              className="h-8 rounded-md px-2.5"
                              disabled={approveMutation.isPending || statusMutation.isPending}
                              onClick={() => approveMutation.mutate(user.id)}
                            >
                              Approve
                            </Button>
                          ) : null}

                          {user.status === "active" ? (
                            <Button
                              variant="outline"
                              className="h-8 rounded-md px-2.5"
                              disabled={statusMutation.isPending || user.isPrimaryAdmin}
                              onClick={() => statusMutation.mutate({ userId: user.id, status: "inactive" })}
                            >
                              Deactivate
                            </Button>
                          ) : null}

                          {user.status === "inactive" ? (
                            <Button
                              variant="outline"
                              className="h-8 rounded-md px-2.5"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ userId: user.id, status: "active" })}
                            >
                              Activate
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          setInviteDialogOpen(open)
          if (!open) {
            setInviteErrors({})
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={onInviteSubmit}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted" htmlFor="invite-user-full-name">
                Full Name
              </label>
              <input
                id="invite-user-full-name"
                value={inviteForm.fullName}
                onChange={(event) => {
                  setInviteForm((current) => ({ ...current, fullName: event.target.value }))
                  setInviteErrors((current) => ({ ...current, fullName: undefined }))
                }}
                placeholder="Jane Doe"
                className={cn(
                  "h-10 w-full rounded-md border bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.2)]",
                  inviteErrors.fullName ? "border-red-300 focus-visible:ring-[rgba(220,38,38,0.2)]" : "border-[color:var(--border-light)]",
                )}
              />
              {inviteErrors.fullName ? <p className="text-xs text-red-600">{inviteErrors.fullName}</p> : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted" htmlFor="invite-user-email">
                Work Email
              </label>
              <input
                id="invite-user-email"
                type="email"
                value={inviteForm.email}
                onChange={(event) => {
                  setInviteForm((current) => ({ ...current, email: event.target.value }))
                  setInviteErrors((current) => ({ ...current, email: undefined }))
                }}
                placeholder={companyDomain ? `jane@${companyDomain}` : "jane@company.com"}
                className={cn(
                  "h-10 w-full rounded-md border bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.2)]",
                  inviteErrors.email ? "border-red-300 focus-visible:ring-[rgba(220,38,38,0.2)]" : "border-[color:var(--border-light)]",
                )}
              />
              {inviteErrors.email ? <p className="text-xs text-red-600">{inviteErrors.email}</p> : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted" htmlFor="invite-user-role">
                Role
              </label>
              <select
                id="invite-user-role"
                value={inviteForm.role}
                onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value as "member" | "admin" }))}
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.2)]"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="h-9 rounded-md" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-9 rounded-md" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Inviting..." : "Send Invite"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
