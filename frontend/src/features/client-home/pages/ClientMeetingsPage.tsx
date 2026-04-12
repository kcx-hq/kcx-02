import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const UPCOMING_MEETINGS = [
  {
    id: "MTG-208",
    title: "Billing ingestion onboarding review",
    when: "Apr 14, 2026 - 11:00 AM",
    mode: "Google Meet",
  },
  {
    id: "MTG-211",
    title: "Optimization recommendations walkthrough",
    when: "Apr 16, 2026 - 04:30 PM",
    mode: "Zoom",
  },
] as const

export function ClientMeetingsPage() {
  return (
    <>
      <section aria-label="Meetings workspace">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">Schedule and track upcoming support meetings.</p>
              <Button className="h-10 rounded-md px-4">Schedule Meeting</Button>
            </div>

            <div className="overflow-hidden rounded-md border border-[color:var(--border-light)] bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[color:var(--bg-surface)] text-left">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Meeting</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">When</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {UPCOMING_MEETINGS.map((meeting) => (
                    <tr key={meeting.id} className="border-t border-[color:var(--border-light)]">
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-semibold text-text-primary">{meeting.id}</p>
                        <p className="text-sm text-text-secondary">{meeting.title}</p>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-text-secondary">{meeting.when}</td>
                      <td className="px-3 py-2.5 text-sm text-text-secondary">{meeting.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
