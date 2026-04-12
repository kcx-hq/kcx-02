import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

type TicketManagementHeroProps = {
  onCreateTicket: () => void
}

export function TicketManagementHero({ onCreateTicket }: TicketManagementHeroProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="mt-1 text-xl font-semibold text-text-primary">Ticket Management</h2>
      </div>
      <Button
        type="button"
        onClick={onCreateTicket}
        className="h-10 rounded-md bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-[color:var(--text-on-dark)] hover:bg-[color:var(--brand-primary-hover)]"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Create Ticket
      </Button>
    </div>
  )
}
