import { Button } from "@/components/ui/button"

type TablePaginationProps = {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPrevious: () => void
  onNext: () => void
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
}: TablePaginationProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-light)] pt-3">
      <p className="text-sm text-text-secondary">
        Showing {start}-{end} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-md"
          disabled={currentPage <= 1}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <span className="min-w-[90px] text-center text-sm text-text-secondary">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-md"
          disabled={currentPage >= totalPages}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

