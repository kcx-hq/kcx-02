import { CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { navigateTo } from "@/lib/navigation"

export function AwsManualSetupSuccess() {
  return (
    <div className="space-y-6">
      <Card className="rounded-md border-emerald-200 bg-emerald-50 shadow-none">
        <CardContent className="space-y-3 p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-emerald-900">AWS connection successful</h3>
            <p className="text-sm leading-6 text-emerald-900/90">
              Your AWS account has been connected successfully. Billing data exports can take up to 24 hours to become available from AWS. Once data is ingested, it will appear in your dashboard.
            </p>
          </div>
          <div className="pt-1">
            <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/overview")}>
              Go to Client Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
