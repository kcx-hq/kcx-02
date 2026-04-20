import type { AdminAnnouncement } from "@/modules/announcements/admin-announcements.api"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { audienceText, formatDateTime, statusVariant } from "@/modules/announcements/components/announcement.helpers"
import { PencilLine } from "lucide-react"

type AnnouncementsTableProps = {
  items: AdminAnnouncement[]
  loading: boolean
  saving: boolean
  onEdit: (item: AdminAnnouncement) => void
  onPublish: (id: string) => void
  onUnpublish: (id: string) => void
  onArchive: (id: string) => void
}

export function AnnouncementsTable({
  items,
  loading,
  saving,
  onEdit,
  onPublish,
  onUnpublish,
  onArchive,
}: AnnouncementsTableProps) {
  return (
    <div className="kcx-admin-table-scroll mt-4 overflow-x-auto">
      <table className="min-w-[1080px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[color:rgba(15,23,42,0.1)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-[color:rgba(15,23,42,0.55)]">
            <th className="px-2 py-3">Title</th>
            <th className="px-2 py-3">Status</th>
            <th className="px-2 py-3">Audience</th>
            <th className="px-2 py-3">Publish At</th>
            <th className="px-2 py-3">Expires At</th>
            <th className="px-2 py-3">Updated</th>
            <th className="px-2 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr className="border-b border-[color:rgba(15,23,42,0.08)]">
              <td className="px-2 py-8 text-[color:rgba(15,23,42,0.62)]" colSpan={7}>
                Loading announcements...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr className="border-b border-[color:rgba(15,23,42,0.08)]">
              <td className="px-2 py-10" colSpan={7}>
                <div className="text-[1.02rem] font-semibold text-[color:rgba(15,23,42,0.82)]">No announcements found</div>
                <div className="mt-2 text-[color:rgba(15,23,42,0.58)]">Try changing filters or broadening search.</div>
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b border-[color:rgba(15,23,42,0.08)]">
                <td className="px-2 py-4">
                  <div className="font-semibold text-[color:rgba(15,23,42,0.9)]">{item.title}</div>
                  <div className="mt-1 max-w-[460px] truncate text-[color:rgba(15,23,42,0.65)]">{item.body}</div>
                </td>
                <td className="px-2 py-4">
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </td>
                <td className="px-2 py-4 text-[color:rgba(15,23,42,0.78)]">{audienceText(item)}</td>
                <td className="px-2 py-4 text-[color:rgba(15,23,42,0.68)]">{formatDateTime(item.publish_at)}</td>
                <td className="px-2 py-4 text-[color:rgba(15,23,42,0.68)]">{formatDateTime(item.expires_at)}</td>
                <td className="px-2 py-4 text-[color:rgba(15,23,42,0.68)]">{formatDateTime(item.updated_at)}</td>
                <td className="px-2 py-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onEdit(item)}
                      disabled={saving}
                      aria-label="Edit announcement"
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                    {item.status !== "PUBLISHED" ? (
                      <Button
                        size="sm"
                        className="rounded-md"
                        onClick={() => onPublish(item.id)}
                        disabled={saving}
                      >
                        Publish
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-md"
                        onClick={() => onUnpublish(item.id)}
                        disabled={saving}
                      >
                        Unpublish
                      </Button>
                    )}
                    {item.status !== "ARCHIVED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-md"
                        onClick={() => onArchive(item.id)}
                        disabled={saving}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
