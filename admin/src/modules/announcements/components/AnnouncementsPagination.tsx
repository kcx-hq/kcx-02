import { Button } from "@/shared/ui/button"

type AnnouncementsPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function getVisiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (page <= 3) return [1, 2, 3, 4, 5]
  if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [page - 2, page - 1, page, page + 1, page + 2]
}

export function AnnouncementsPagination({ page, totalPages, onPageChange }: AnnouncementsPaginationProps) {
  if (totalPages <= 1) return null

  const visiblePages = getVisiblePages(page, totalPages)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:rgba(15,23,42,0.08)] pt-4">
      <div className="text-sm font-semibold text-[color:rgba(15,23,42,0.68)]">
        Page {page} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-md" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        {visiblePages.map((item) => (
          <Button
            key={item}
            variant={item === page ? "default" : "outline"}
            size="sm"
            className="min-w-9 rounded-md px-0"
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="rounded-md" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  )
}
