import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MessageSquareText } from "lucide-react"

import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"

export function ClientLiveChatPage() {
  return (
    <>
      <ClientPageHeader
        eyebrow="Support"
        title="Live Chat"
        description="Start a real-time conversation with KCX support."
      />

      <section aria-label="Live chat workspace">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-text-secondary">
              Chat support is available during business hours for quick issue triage and guidance.
            </p>
            <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-5 text-center">
              <MessageSquareText className="mx-auto h-7 w-7 text-text-muted" />
              <p className="mt-2 text-sm text-text-muted">Chat window placeholder.</p>
            </div>
            <Button className="h-10 rounded-md px-4">Open Live Chat</Button>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
