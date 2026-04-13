import { useMemo, useState } from "react"
import type { FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { TicketCreatePayload, TicketPriority } from "@/features/client-home/components/ticket-management/types"

type TicketCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  submitting?: boolean
  onSubmit: (payload: TicketCreatePayload, mode: "submit" | "draft") => void
}

const CATEGORY_OPTIONS = [
  "Billing Ingestion",
  "Cloud Connection",
  "Cost Anomaly",
  "Report & Dashboard",
  "Access & Permissions",
  "Other",
] as const

const PRIORITY_OPTIONS: TicketPriority[] = ["Low", "Medium", "High", "Urgent"]

type FormState = {
  title: string
  category: string
  priority: TicketPriority
  affected: string
  attachments: string[]
  description: string
}

const INITIAL_FORM: FormState = {
  title: "",
  category: "Billing Ingestion",
  priority: "Medium",
  affected: "",
  attachments: [],
  description: "",
}

export function TicketCreateDialog({ open, onOpenChange, submitting = false, onSubmit }: TicketCreateDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const errors = useMemo(() => {
    return {
      title: form.title.trim().length === 0 ? "Ticket title is required." : "",
      affected: form.affected.trim().length === 0 ? "Affected service/resource is required." : "",
      description: form.description.trim().length < 10 ? "Description must be at least 10 characters." : "",
    }
  }, [form.affected, form.description, form.title])

  const isValid = Object.values(errors).every((value) => !value)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setHasSubmitted(false)
  }

  function buildPayload(mode: "submit" | "draft"): TicketCreatePayload | null {
    setHasSubmitted(true)
    if (mode === "submit" && !isValid) return null

    return {
      title: form.title.trim(),
      category: form.category,
      priority: form.priority,
      affected: form.affected.trim(),
      attachments: form.attachments,
      description: form.description.trim(),
      saveAsDraft: mode === "draft",
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = buildPayload("submit")
    if (!payload) return
    onSubmit(payload, "submit")

    onOpenChange(false)
    resetForm()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
                placeholder="Brief issue summary"
              />
              {hasSubmitted && errors.title ? <p className="text-xs text-rose-600">{errors.title}</p> : null}
            </label>

            <label className="min-w-[180px] space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Issue Category</span>
              <select
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-[150px] space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Priority</span>
              <select
                value={form.priority}
                onChange={(event) => setField("priority", event.target.value as TicketPriority)}
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] flex-1 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Affected</span>
              <input
                type="text"
                value={form.affected}
                onChange={(event) => setField("affected", event.target.value)}
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
                placeholder="Affected service, account, or module"
              />
              {hasSubmitted && errors.affected ? <p className="text-xs text-rose-600">{errors.affected}</p> : null}
            </label>

            <label className="min-w-[260px] flex-1 space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Attachments</span>
              <input
                type="file"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  setField(
                    "attachments",
                    files.map((file) => file.name)
                  )
                }}
                className="block h-10 w-full rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium"
              />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Description</span>
            <input
              type="text"
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              className="h-10 w-full rounded-[7px] border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--kcx-border-strong)]"
              placeholder="Describe the issue for KCX support"
            />
            {hasSubmitted && errors.description ? <p className="text-xs text-rose-600">{errors.description}</p> : null}
          </label>

          <div className="pt-1">
            <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-md px-4"
              disabled={submitting}
              onClick={() => {
                const payload = buildPayload("draft")
                if (!payload) return
                onSubmit(payload, "draft")
                onOpenChange(false)
                resetForm()
              }}
            >
              Save as Draft
            </Button>
            <Button type="submit" className="h-10 rounded-md px-4" disabled={submitting || (!isValid && hasSubmitted)}>
              {submitting ? "Submitting..." : "Submit to KCX"}
            </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
