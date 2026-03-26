import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"

const PLACEHOLDER_TICKETS = [
  { id: "t-1", title: "No active tickets yet", status: "Pending" },
  { id: "t-2", title: "Create a ticket to start support workflow", status: "Pending" },
]

export function ClientTicketsPage() {
  return (
    <>
      <ClientPageHeader
        eyebrow="Tickets Workspace"
        title="Tickets"
        description="Track issue resolution, requests, and ongoing support communication."
      />

      <section aria-label="Ticket list placeholder">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PLACEHOLDER_TICKETS.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="text-text-primary">{ticket.title}</TableCell>
                    <TableCell>{ticket.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-4 text-sm text-text-muted">Ticket activity will populate here once client tickets are created.</p>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
