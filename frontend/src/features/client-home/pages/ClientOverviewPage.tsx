import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { navigateTo } from "@/lib/navigation"
import { Cloud, Upload } from "lucide-react"

export function ClientOverviewPage() {
  function openUploadPage() {
    navigateTo("/client/billing/uploads")
  }

  function openConnectCloudPage() {
    navigateTo("/client/billing/cloud-integration")
  }

  return (
    <div className="space-y-5">
      <section aria-label="Welcome" className="space-y-6 rounded-[14px] border border-[color:var(--border-light)] bg-[#f7fbfb] p-6 shadow-sm-custom">
        <div className="space-y-3 border-b border-[color:var(--border-light)] pb-5">
          <p className="kcx-eyebrow text-brand-primary">GET STARTED</p>
          <h1 className="kcx-heading text-3xl font-semibold tracking-tight text-text-primary">Welcome To KCX</h1>
          <p className="max-w-3xl text-base text-text-secondary">
            Start your cloud cost journey in two quick steps. Connect a billing source, then open your dashboards for insights.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-none border-[color:var(--border-light)] bg-[#f7fbfb] shadow-none">
            <CardContent className="space-y-4 p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-[color:var(--border-light)] bg-transparent text-text-secondary">
                <Cloud className="h-4 w-4" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text-primary">Connect Cloud Account</h2>
                <p className="text-sm leading-6 text-text-secondary">
                  Connect AWS or other providers for automated ingestion and continuous cost monitoring.
                </p>
              </div>
              <Button className="h-10 rounded-none" onClick={openConnectCloudPage}>Connect Cloud</Button>
            </CardContent>
          </Card>

          <Card className="rounded-none border-[color:var(--border-light)] bg-[#f7fbfb] shadow-none">
            <CardContent className="space-y-4 p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-[color:var(--border-light)] bg-transparent text-text-secondary">
                <Upload className="h-4 w-4" />
              </span>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-text-primary">Upload Billing File</h2>
                <p className="text-sm leading-6 text-text-secondary">
                  Upload your latest CSV or parquet billing file and begin cost analysis immediately.
                </p>
              </div>
              <Button className="h-10 rounded-none" onClick={openUploadPage}>Upload File</Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
