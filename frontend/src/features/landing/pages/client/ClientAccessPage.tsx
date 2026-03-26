import { PageFooter } from "@/components/layout/PageFooter"
import { PageHero } from "@/components/layout/PageHero"

type ClientAccessMode = "schedule-demo" | "client-sign-in"

type ClientAccessPageProps = {
  mode: ClientAccessMode
}

export function ClientAccessPage({ mode }: ClientAccessPageProps) {
  const isScheduleDemo = mode === "schedule-demo"

  return (
    <>
      <PageHero
        eyebrow={isScheduleDemo ? "Get Started / Schedule Demo" : "Client Access / Sign In"}
        title={isScheduleDemo ? "Schedule Demo Is Currently Disabled" : "Client Sign-In Is Currently Disabled"}
        description="This route has been disconnected from navigation as requested."
        variant="resources"
      />
      <PageFooter />
    </>
  )
}
