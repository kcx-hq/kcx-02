import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ApiError, apiGet, apiPost } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type AwsAutomaticSetupProps = {
  activeRoute: string
}

type CloudConnectionCreateResponse = {
  id: string
}

function validateAutoConnectionName(value: string) {
  return value.trim().length > 0
}

export function AwsAutomaticSetup({ activeRoute }: AwsAutomaticSetupProps) {
  const [autoConnectionName, setAutoConnectionName] = useState("")
  const [autoAccountType, setAutoAccountType] = useState<"payer" | "member">("payer")
  const [autoTouched, setAutoTouched] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)

  const awsBaseRoute = activeRoute.startsWith("/client/billing/connections/")
    ? "/client/billing/connections/aws"
    : "/client/billing/connect-cloud/aws"

  function onSubmitAutomaticSetup() {
    setAutoTouched(true)
    setAutoError(null)
    if (!validateAutoConnectionName(autoConnectionName)) return

    // Open a tab immediately from the user click to avoid popup blockers.
    // Do not use noopener here because some browsers return null window handles,
    // which prevents us from assigning the backend URL after async calls complete.
    const setupTab = window.open("about:blank", "_blank")
    setAutoSubmitting(true)
    void (async () => {
      try {
        const created = await apiPost<CloudConnectionCreateResponse>("/cloud-connections", {
          connection_name: autoConnectionName.trim(),
          provider: "aws",
          status: "draft",
          account_type: autoAccountType,
        })

        const setup = await apiGet<{ url: string }>(`/cloud-connections/${created.id}/aws-cloudformation-url`)
        if (setupTab) {
          setupTab.opener = null
          setupTab.location.href = setup.url
        } else {
          window.open(setup.url, "_blank", "noopener,noreferrer")
        }
      } catch (error) {
        if (setupTab && !setupTab.closed) {
          setupTab.close()
        }
        if (error instanceof ApiError) {
          setAutoError(error.message || "Failed to create connection")
        } else {
          setAutoError("Failed to create connection")
        }
      } finally {
        setAutoSubmitting(false)
      }
    })()
  }

  return (
    <>
      <div className="space-y-2">
        <p className="kcx-eyebrow text-brand-primary">AWS Automatic Setup</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Start Automatic Setup</h2>
        <p className="text-sm text-text-secondary">Create an AWS connection to begin guided setup.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            Connection Name
            <span className="ml-2 align-middle text-[11px] font-semibold text-brand-primary">Required</span>
          </span>
          <input
            className={cn(
              "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
              autoTouched && !validateAutoConnectionName(autoConnectionName)
                ? "border-rose-300"
                : "border-[color:var(--border-light)]"
            )}
            placeholder="prod-aws-account"
            value={autoConnectionName}
            onChange={(event) => setAutoConnectionName(event.target.value)}
            onBlur={() => setAutoTouched(true)}
            required
          />
          {autoTouched && !validateAutoConnectionName(autoConnectionName) ? (
            <p className="text-xs text-rose-600">Connection Name is required.</p>
          ) : null}
          {autoError ? <p className="text-xs text-rose-600">{autoError}</p> : null}
        </label>

        <fieldset className="space-y-2 md:col-span-2">
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            Account Type
            <span className="ml-2 align-middle text-[11px] font-semibold text-brand-primary">Required</span>
          </legend>
          <div className="space-y-2 rounded-md border border-[color:var(--border-light)] bg-white p-3">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name="aws-account-type"
                value="payer"
                checked={autoAccountType === "payer"}
                onChange={() => setAutoAccountType("payer")}
                className="h-4 w-4 accent-[color:var(--brand-primary)]"
              />
              <span className="font-medium">Payer Account</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name="aws-account-type"
                value="member"
                checked={autoAccountType === "member"}
                onChange={() => setAutoAccountType("member")}
                className="h-4 w-4 accent-[color:var(--brand-primary)]"
              />
              <span className="font-medium">Member Account</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button className="h-10 rounded-md" disabled={autoSubmitting} onClick={onSubmitAutomaticSetup}>
          {autoSubmitting ? "Saving..." : "Continue Setup"}
        </Button>
        <Button
          variant="ghost"
          className="h-10 rounded-md"
          onClick={() => navigateTo(awsBaseRoute)}
        >
          Back
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </>
  )
}
