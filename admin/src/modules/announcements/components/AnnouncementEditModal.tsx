import type {
  AdminAnnouncement,
  AnnouncementAudienceScope,
  AnnouncementAudienceTier,
  AnnouncementStatus,
} from "@/modules/announcements/admin-announcements.api"
import type { AdminClientSummary } from "@/modules/clients/admin-clients.api"
import { Button } from "@/shared/ui/button"
import {
  STATUS_OPTIONS,
  toClientLabel,
  toIsoValue,
  toLocalInputValue,
} from "@/modules/announcements/components/announcement.helpers"

const INPUT_CLASS =
  "h-10 rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"

type AnnouncementEditModalProps = {
  selected: AdminAnnouncement | null
  clients: AdminClientSummary[]
  saving: boolean
  errorMessage?: string | null
  onClose: () => void
  onChange: (updater: (prev: AdminAnnouncement | null) => AdminAnnouncement | null) => void
  onSave: () => void
}

export function AnnouncementEditModal({ selected, clients, saving, errorMessage, onClose, onChange, onSave }: AnnouncementEditModalProps) {
  if (!selected) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(2,6,23,0.45)] p-4">
      <div className="w-full max-w-2xl rounded-xl border border-[color:rgba(15,23,42,0.12)] bg-white p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[color:rgba(15,23,42,0.92)]">Edit announcement</h2>
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

          <input
            className={`${INPUT_CLASS} w-full`}
            value={selected.title}
            onChange={(e) => onChange((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
          />
          <textarea
            className="min-h-[110px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
            value={selected.body}
            onChange={(e) => onChange((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className={INPUT_CLASS}
              value={selected.status}
              onChange={(e) => onChange((prev) => (prev ? { ...prev, status: e.target.value as AnnouncementStatus } : prev))}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              className={INPUT_CLASS}
              value={selected.audience_scope}
              onChange={(e) =>
                onChange((prev) =>
                  prev
                    ? {
                        ...prev,
                        audience_scope: e.target.value as AnnouncementAudienceScope,
                        audience_client_ids: e.target.value === "CLIENT_IDS" ? prev.audience_client_ids ?? [] : null,
                        audience_tier: e.target.value === "CLIENT_TIER" ? prev.audience_tier ?? "PREMIUM" : null,
                      }
                    : prev
                )
              }
            >
              <option value="ALL">All clients</option>
              <option value="CLIENT_TIER">Client tier</option>
              <option value="CLIENT_IDS">Specific clients</option>
            </select>

            <input
              className={INPUT_CLASS}
              type="datetime-local"
              value={toLocalInputValue(selected.publish_at)}
              onChange={(e) => onChange((prev) => (prev ? { ...prev, publish_at: toIsoValue(e.target.value) } : prev))}
            />
          </div>

          {selected.audience_scope === "CLIENT_TIER" ? (
            <select
              className={`${INPUT_CLASS} w-full`}
              value={selected.audience_tier ?? "PREMIUM"}
              onChange={(e) => onChange((prev) => (prev ? { ...prev, audience_tier: e.target.value as AnnouncementAudienceTier } : prev))}
            >
              <option value="PREMIUM">Premium</option>
              <option value="STANDARD">Standard</option>
            </select>
          ) : null}

          {selected.audience_scope === "CLIENT_IDS" ? (
            <select
              multiple
              className="min-h-[96px] w-full rounded-md border border-[color:rgba(15,23,42,0.12)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:rgba(47,125,106,0.45)]"
              value={selected.audience_client_ids ?? []}
              onChange={(e) =>
                onChange((prev) =>
                  prev
                    ? {
                        ...prev,
                        audience_client_ids: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                      }
                    : prev
                )
              }
            >
              {clients.map((client) => (
                <option key={String(client.id)} value={String(client.id)}>
                  {toClientLabel(client)} ({client.email})
                </option>
              ))}
            </select>
          ) : null}

          <input
            className={`${INPUT_CLASS} w-full`}
            type="datetime-local"
            value={toLocalInputValue(selected.expires_at)}
            onChange={(e) => onChange((prev) => (prev ? { ...prev, expires_at: toIsoValue(e.target.value) } : prev))}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" className="rounded-md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="rounded-md" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
