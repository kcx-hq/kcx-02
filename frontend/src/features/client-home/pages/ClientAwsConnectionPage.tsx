import { useEffect, useMemo, useState } from "react"

import { AwsAutomaticSetup } from "@/features/client-home/components/AwsAutomaticSetup"
import { AwsManualSetup, AWS_MANUAL_EXPLORER_ROUTE_REGEX } from "@/features/client-home/components/AwsManualSetup"
import { AwsManualSetupSuccess } from "@/features/client-home/components/AwsManualSetupSuccess"
import {
  ClientPageContentContainer,
  CLIENT_PAGE_SECTION_SPACING_CLASS,
} from "@/features/client-home/components/ClientPageContentContainer"
import { AwsSetupConnectionSection } from "@/features/client-home/components/billing/AwsSetupConnectionSection"
import {
  AWS_MANUAL_SUCCESS_ROUTE_REGEX,
  AWS_SETUP_ROUTE_REGEX,
  type CloudConnection,
} from "@/features/client-home/components/billing/billingHelpers"
import { ApiError, apiGet } from "@/lib/api"
import { navigateTo, useCurrentRoute } from "@/lib/navigation"

export function ClientAwsConnectionPage() {
  const activeRoute = useCurrentRoute()
  const isLegacyConnectionsRoute = activeRoute.startsWith("/client/billing/connections/")
  const awsBaseRoute = isLegacyConnectionsRoute
    ? "/client/billing/connections/aws"
    : "/client/billing/connect-cloud/aws"

  const isManualSuccessRoute = AWS_MANUAL_SUCCESS_ROUTE_REGEX.test(activeRoute)
  const isManualExplorerRoute = AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(activeRoute)
  const isManualRoute = activeRoute.endsWith("/manual") || isManualExplorerRoute || isManualSuccessRoute
  const isAutomaticRoute = activeRoute.endsWith("/automatic")

  const [activeTab, setActiveTab] = useState<"automatic" | "manual">(isManualRoute ? "manual" : "automatic")

  useEffect(() => {
    if (isManualRoute) {
      setActiveTab("manual")
      return
    }
    if (isAutomaticRoute) {
      setActiveTab("automatic")
    }
  }, [isAutomaticRoute, isManualRoute])

  const setupConnectionId = useMemo(() => {
    const match = AWS_SETUP_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])

  const [setupConnection, setSetupConnection] = useState<CloudConnection | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    if (!setupConnectionId) return
    setSetupLoading(true)
    setSetupError(null)

    void (async () => {
      try {
        const connection = await apiGet<CloudConnection>(`/cloud-connections/${setupConnectionId}`)
        setSetupConnection(connection)
      } catch (error) {
        if (error instanceof ApiError) {
          setSetupError(error.message || "Failed to load connection")
        } else {
          setSetupError("Failed to load connection")
        }
        setSetupConnection(null)
      } finally {
        setSetupLoading(false)
      }
    })()
  }, [setupConnectionId])

  function handleTabChange(tab: "automatic" | "manual") {
    setActiveTab(tab)
    if (activeRoute !== awsBaseRoute) {
      navigateTo(awsBaseRoute)
    }
  }

  return (
    <ClientPageContentContainer className={CLIENT_PAGE_SECTION_SPACING_CLASS}>
      <section aria-label="AWS cloud connection" className="overflow-hidden rounded-[8px] border border-[color:var(--border-light)] bg-white shadow-sm-custom">
        {!setupConnectionId && !isManualSuccessRoute ? (
          <nav aria-label="AWS setup tabs" className="rounded-t-[8px] border-b border-[color:var(--border-light)]">
            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => handleTabChange("automatic")}
                className={`h-9 border-b-[3px] text-sm transition-colors first:rounded-tl-[8px] ${
                  activeTab === "automatic"
                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] font-medium text-white"
                    : "border-transparent font-medium text-text-muted hover:text-text-primary"
                }`}
              >
                Automatic Setup
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("manual")}
                className={`h-9 border-b-[3px] text-sm transition-colors last:rounded-tr-[8px] ${
                  activeTab === "manual"
                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] font-medium text-white"
                    : "border-transparent font-medium text-text-muted hover:text-text-primary"
                }`}
              >
                Manual Setup
              </button>
            </div>
          </nav>
        ) : null}

        <div className="space-y-3 px-4 py-3 md:px-6 md:py-4">
          {setupConnectionId ? (
            <AwsSetupConnectionSection
              setupLoading={setupLoading}
              setupError={setupError}
              setupConnection={setupConnection}
              onLaunchAwsSetup={() => window.open("/integrations/aws", "_blank", "noopener,noreferrer")}
              onBackToSetupChoice={() => navigateTo(awsBaseRoute)}
            />
          ) : isManualSuccessRoute ? (
            <>
              <div className="space-y-2">
                <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
                <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Success</h2>
                <p className="text-sm text-text-secondary">Your manual AWS connection is complete.</p>
              </div>
              <AwsManualSetupSuccess />
            </>
          ) : activeTab === "manual" || isManualExplorerRoute || isManualRoute ? (
            <>
              <div className="space-y-2">
                <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
                <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Manual Setup</h2>
                <p className="text-sm text-text-secondary">Connect your AWS billing data in one guided setup flow.</p>
              </div>
              <AwsManualSetup activeRoute={activeRoute} />
            </>
          ) : (
            <AwsAutomaticSetup activeRoute={activeRoute} />
          )}
        </div>
      </section>
    </ClientPageContentContainer>
  )
}
