import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Cloud, Upload } from "lucide-react"

export function ClientOverviewPage() {
  return (
    <div className="space-y-5">
      <section aria-label="Get Started" className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfa_100%)] p-6 shadow-sm-custom">
        <div className="space-y-2">
          <p className="kcx-eyebrow text-brand-primary">Start Here</p>
          <h1 className="kcx-heading text-2xl font-semibold tracking-tight text-text-primary">Connect Your Billing Data</h1>
          <p className="max-w-3xl text-sm text-text-secondary">
            Get started by connecting your billing data to unlock insights and cost visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
            <CardContent className="space-y-4 p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <Upload className="h-4 w-4" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text-primary">Upload Billing CSV</h2>
                <p className="text-sm leading-6 text-text-secondary">
                  Upload your billing data manually to start analyzing costs instantly.
                </p>
              </div>
              <Button className="h-10 rounded-md" onClick={openUploadDialog}>Upload CSV</Button>
            </CardContent>
          </Card>

          <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
            <CardContent className="space-y-4 p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary">
                <Cloud className="h-4 w-4" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text-primary">Connect Cloud Account</h2>
                <p className="text-sm leading-6 text-text-secondary">
                  Connect AWS or other providers for automated billing ingestion.
                </p>
              </div>
              <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)] bg-transparent">
                Connect AWS
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
