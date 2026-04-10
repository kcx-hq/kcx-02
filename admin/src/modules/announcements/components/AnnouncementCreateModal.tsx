import type {
  AnnouncementAudienceScope,
  AnnouncementAudienceTier,
  AnnouncementStatus,
} from "@/modules/announcements/admin-announcements.api"
import type { AdminClientSummary } from "@/modules/clients/admin-clients.api"
import { Button } from "@/shared/ui/button"
import { STATUS_OPTIONS, toClientLabel } from "@/modules/announcements/components/announcement.helpers"

const INPUT_CLASS =
  "h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
const DATE_INPUT_CLASS =
  "h-11 w-full rounded-md border border-[color:rgba(15,23,42,0.14)] bg-white px-3 text-sm text-[color:rgba(15,23,42,0.9)] outline-none focus:border-[color:rgba(47,125,106,0.45)]"

export type CreateAnnouncementDraft = {
  title: string
  body: string
  status: AnnouncementStatus
  audienceScope: AnnouncementAudienceScope
  audienceClientIds: string[]
  audienceTier: AnnouncementAudienceTier
  publishAt: string
  expiresAt: string
}

type AnnouncementCreateModalProps = {
  open: boolean
  draft: CreateAnnouncementDraft
  clients: AdminClientSummary[]
  saving: boolean
  errorMessage?: string | null
  onClose: () => void
  onDraftChange: (updater: (prev: CreateAnnouncementDraft) => CreateAnnouncementDraft) => void
  onClear: () => void
  onSave: () => void
}

export function AnnouncementCreateModal({
  open,
  draft,
  clients,
  saving,
  errorMessage,
  onClose,
  onDraftChange,
  onClear,
  onSave,
}: AnnouncementCreateModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(2,6,23,0.45)] p-4">
      <div className="w-full max-w-2xl rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[color:rgba(15,23,42,0.92)]">Create announcement</h2>
          <Button size="sm" variant="ghost" className="rounded-md" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-3">
          {errorMessage ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-[color:rgba(15,23,42,0.86)]">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className={INPUT_CLASS}
              value={draft.title}
              onChange={(e) => onDraftChange((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
            />
            <select
              className={INPUT_CLASS}
              value={draft.status}
              onChange={(e) => onDraftChange((prev) => ({ ...prev, status: e.target.value as AnnouncementStatus }))}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className="min-h-[110px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
            value={draft.body}
            onChange={(e) => onDraftChange((prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Message body"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className={INPUT_CLASS}
              value={draft.audienceScope}
              onChange={(e) => onDraftChange((prev) => ({ ...prev, audienceScope: e.target.value as AnnouncementAudienceScope }))}
            >
              <option value="ALL">All clients</option>
              <option value="CLIENT_TIER">Client tier</option>
              <option value="CLIENT_IDS">Specific clients</option>
            </select>

            {draft.audienceScope === "CLIENT_TIER" ? (
              <select
                className={INPUT_CLASS}
                value={draft.audienceTier}
                onChange={(e) => onDraftChange((prev) => ({ ...prev, audienceTier: e.target.value as AnnouncementAudienceTier }))}
              >
                <option value="PREMIUM">Premium</option>
                <option value="STANDARD">Standard</option>
              </select>
            ) : <div />}
          </div>

          {draft.audienceScope === "CLIENT_IDS" ? (
            <select
              multiple
              className="min-h-[96px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={draft.audienceClientIds}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  audienceClientIds: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                }))
              }
            >
              {clients.map((client) => (
                <option key={String(client.id)} value={String(client.id)}>
                  {toClientLabel(client)} ({client.email})
                </option>
              ))}
            </select>
          ) : null}

          <div className="space-y-3 rounded-md border border-[color:rgba(15,23,42,0.1)] bg-[color:rgba(248,250,252,0.65)] p-3">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[color:rgba(15,23,42,0.52)]">Schedule</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-[color:rgba(15,23,42,0.7)]">Publish date</div>
                <input
                  className={DATE_INPUT_CLASS}
                  type="datetime-local"
                  value={draft.publishAt}
                  onChange={(e) => onDraftChange((prev) => ({ ...prev, publishAt: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-[color:rgba(15,23,42,0.7)]">Expiry date</div>
                <input
                  className={DATE_INPUT_CLASS}
                  type="datetime-local"
                  value={draft.expiresAt}
                  onChange={(e) => onDraftChange((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-md" onClick={onClear} disabled={saving}>
                Clear
              </Button>
              <Button className="rounded-md" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save announcement"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
