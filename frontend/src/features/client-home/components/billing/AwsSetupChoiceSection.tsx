import { Cloud, Wrench } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type AwsSetupChoiceSectionProps = {
  onSelectAutomatic: () => void
  onSelectManual: () => void
}

export function AwsSetupChoiceSection({ onSelectAutomatic, onSelectManual }: AwsSetupChoiceSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <p className="kcx-eyebrow text-brand-primary">AWS Setup Choice</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Setup Method</h2>
        <p className="text-sm text-text-secondary">Select how you want to connect AWS billing data into KCX.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <CardContent className="space-y-3 p-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-white text-text-secondary">
              <Cloud className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-text-primary">Automatic Setup </h3>
            <p className="text-sm text-text-secondary">Guided cloud-native onboarding with secure automated provisioning.</p>
            <Button
              variant="outline"
              className="h-10 rounded-md border-[color:var(--border-light)]"
              onClick={onSelectAutomatic}
            >
              Start Automatic Setup
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]">
          <CardContent className="space-y-3 p-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--kcx-border-soft)] bg-white text-brand-primary">
              <Wrench className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-text-primary">Manual Setup</h3>
            <p className="text-sm text-text-secondary">Guided manual setup using custom trust policy and IAM role validation.</p>
            <Button className="h-10 rounded-md" onClick={onSelectManual}>
              Open Manual Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
