import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
  ExternalLink,
  Check,
  Copy,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  browseAwsManualBucket,
  type AwsManualBrowseBucketItem,
  testAwsManualConnection,
} from "@/features/client-home/api/cloud-connections.api"
import { ApiError } from "@/lib/api"
import { getAuthUser } from "@/lib/auth"
import { navigateTo } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const EXTERNAL_ID_LENGTH = 24

function generateExternalId(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

type AwsManualSetupStepTwoProps = {
  roleName: string
  customPolicyName: string
  onRoleNameChange: (value: string) => void
  onCustomPolicyNameChange: (value: string) => void
  bucketNameHint?: string
  onExternalIdChange?: (value: string) => void
}

function AwsManualSetupStepTwo({
  roleName,
  customPolicyName,
  onRoleNameChange,
  onCustomPolicyNameChange,
  bucketNameHint = "",
  onExternalIdChange,
}: AwsManualSetupStepTwoProps) {
  const iamConsoleUrl = "https://console.aws.amazon.com/iam/home#/roles"
  const iamPoliciesConsoleUrl = "https://console.aws.amazon.com/iam/home#/policies"
  const [copiedManagedPolicy, setCopiedManagedPolicy] = useState<null | "billing" | "view">(null)
  const [copiedCustomPolicyName, setCopiedCustomPolicyName] = useState(false)
  const [copiedCustomPolicy, setCopiedCustomPolicy] = useState(false)
  const [copiedTrustPolicy, setCopiedTrustPolicy] = useState(false)
  const [externalId, setExternalId] = useState("")
  const [showGeneratedCustomPolicy, setShowGeneratedCustomPolicy] = useState(false)
  const [showGeneratedTrustPolicy, setShowGeneratedTrustPolicy] = useState(false)
  const [generatedCustomPolicy, setGeneratedCustomPolicy] = useState<string | null>(null)

  const authUser = getAuthUser()
  const externalIdStorageKey = useMemo(
    () => `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`,
    [authUser?.id],
  )

  useEffect(() => {
    const existing = localStorage.getItem(externalIdStorageKey)
    if (existing && existing.length === EXTERNAL_ID_LENGTH) {
      setExternalId(existing)
      onExternalIdChange?.(existing)
      return
    }

    const nextExternalId = generateExternalId(EXTERNAL_ID_LENGTH)
    localStorage.setItem(externalIdStorageKey, nextExternalId)
    setExternalId(nextExternalId)
    onExternalIdChange?.(nextExternalId)
  }, [externalIdStorageKey, onExternalIdChange])

  const managedPolicies = [
    { key: "billing" as const, name: "AWSBillingReadOnlyAccess" },
    { key: "view" as const, name: "ViewOnlyAccess" },
  ]

  const kcxPrincipalArn = useMemo(() => {
    const value = (import.meta.env as Record<string, unknown>).VITE_KCX_AWS_PRINCIPAL_ARN
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
    return "arn:aws:iam::275017715736:root"
  }, [])

  function buildCustomPolicyJson(bucketName: string) {
    return JSON.stringify(
      {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "KCXBillingBucketListAccess",
            Effect: "Allow",
            Action: ["s3:ListBucket", "s3:GetBucketLocation"],
            Resource: [`arn:aws:s3:::${bucketName}`],
          },
          {
            Sid: "KCXBillingBucketObjectReadAccess",
            Effect: "Allow",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      },
      null,
      2,
    )
  }

  function buildTrustPolicyJson(principalArn: string, generatedExternalId: string) {
    return JSON.stringify(
      {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              AWS: principalArn,
            },
            Action: "sts:AssumeRole",
            Condition: {
              StringEquals: {
                "sts:ExternalId": generatedExternalId,
              },
            },
          },
        ],
      },
      null,
      2,
    )
  }

  const generatedTrustPolicy = useMemo(() => {
    if (!externalId) return null
    return buildTrustPolicyJson(kcxPrincipalArn, externalId)
  }, [kcxPrincipalArn, externalId])

  async function handleCopyManagedPolicy(policyKey: "billing" | "view", policyName: string) {
    try {
      await navigator.clipboard.writeText(policyName)
      setCopiedManagedPolicy(policyKey)
      window.setTimeout(() => setCopiedManagedPolicy(null), 1500)
    } catch {
      setCopiedManagedPolicy(null)
    }
  }

  async function handleCopyCustomPolicy() {
    if (!generatedCustomPolicy) return

    try {
      await navigator.clipboard.writeText(generatedCustomPolicy)
      setCopiedCustomPolicy(true)
      window.setTimeout(() => setCopiedCustomPolicy(false), 1500)
    } catch {
      setCopiedCustomPolicy(false)
    }
  }

  async function handleCopyTrustPolicy() {
    if (!generatedTrustPolicy) return

    try {
      await navigator.clipboard.writeText(generatedTrustPolicy)
      setCopiedTrustPolicy(true)
      window.setTimeout(() => setCopiedTrustPolicy(false), 1500)
    } catch {
      setCopiedTrustPolicy(false)
    }
  }

  async function handleCopyCustomPolicyName() {
    const policyName = customPolicyName.trim()
    if (!policyName) return
    try {
      await navigator.clipboard.writeText(policyName)
      setCopiedCustomPolicyName(true)
      window.setTimeout(() => setCopiedCustomPolicyName(false), 1500)
    } catch {
      setCopiedCustomPolicyName(false)
    }
  }

  function handleGenerateCustomPolicy() {
    const stepOneBucketName = bucketNameHint.trim()
    if (!stepOneBucketName || /\s/.test(stepOneBucketName)) return
    setGeneratedCustomPolicy(buildCustomPolicyJson(stepOneBucketName))
    setCopiedCustomPolicy(false)
    setShowGeneratedCustomPolicy(false)
  }

  return (
    <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">IAM Setup</p>
          <h3 className="text-lg font-semibold text-text-primary">Configure Cross-Account Access</h3>
          <p className="text-sm leading-6 text-text-secondary">
            Create an IAM role in your AWS account to allow KCX read-only access.
          </p>
        </div>

        <div className="border-t border-[color:var(--border-light)]" />

        <section className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-text-primary">2.1 Create Custom S3 Policy</h4>
            <p className="text-sm leading-6 text-text-secondary">
              Generate a bucket-scoped custom IAM policy first. You will attach this policy during IAM role creation in Step 2.3.
            </p>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Quick steps in AWS</p>
            <ol className="mt-2 space-y-1.5 text-sm leading-6 text-text-secondary">
              <li>1. Generate the custom S3 bucket policy in KCX and copy the generated JSON.</li>
              <li>2. In AWS IAM Policies, select <span className="font-semibold text-text-primary">Create policy</span> and paste the copied JSON.</li>
              <li>3. Assign a clear policy name and save the policy.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">KCX custom policy</p>
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-sm font-semibold text-text-primary">KCX Custom S3 Access Policy</p>
              <p className="mt-1 text-sm text-text-secondary">
                Create this as a custom IAM policy in AWS before creating the role.
              </p>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-text-secondary">
                  {bucketNameHint.trim()
                    ? `Using Step 1 bucket: ${bucketNameHint.trim()}`
                    : "Add a valid S3 bucket in Step 1 to enable policy generation."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-md border-[color:var(--border-light)]"
                  onClick={handleGenerateCustomPolicy}
                  disabled={!bucketNameHint.trim() || /\s/.test(bucketNameHint)}
                >
                  Generate IAM Policy
                </Button>
              </div>

              {generatedCustomPolicy && showGeneratedCustomPolicy ? (
                <pre className="mt-3 overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-white p-3 text-xs leading-5 text-text-secondary">
{generatedCustomPolicy}
                </pre>
              ) : generatedCustomPolicy ? (
                <p className="mt-3 text-xs text-text-secondary">
                  Policy generated successfully. Use <span className="font-medium text-text-primary">View Policy JSON</span> if you want to review it.
                </p>
              ) : (
                <p className="mt-3 text-xs text-text-secondary">
                  Generate policy JSON and create it in AWS IAM Policies.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md px-3 text-xs"
                  onClick={() => {
                    void handleCopyCustomPolicy()
                  }}
                  disabled={!generatedCustomPolicy}
                >
                  {copiedCustomPolicy ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                  {copiedCustomPolicy ? "Copied policy" : "Copy policy JSON"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md px-3 text-xs"
                  onClick={() => setShowGeneratedCustomPolicy((prev) => !prev)}
                  disabled={!generatedCustomPolicy}
                >
                  {showGeneratedCustomPolicy ? "Hide Policy JSON" : "View Policy JSON"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Save the custom policy name now. You will use this exact name when attaching permissions during role creation.
              </p>
              <label className="mt-3 block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Custom Policy Name</span>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                    placeholder="e.g. KCXBillingBucketReadPolicy"
                    value={customPolicyName}
                    onChange={(event) => onCustomPolicyNameChange(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-md px-3 text-xs"
                    onClick={() => {
                      void handleCopyCustomPolicyName()
                    }}
                    disabled={!customPolicyName.trim()}
                  >
                    {copiedCustomPolicyName ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    {copiedCustomPolicyName ? "Copied" : "Copy name"}
                  </Button>
                </div>
              </label>
              {/* TODO: Optionally tighten scope further to a specific prefix once prefix-aware generation is enabled. */}
              {/* TODO: Bind generated policy to backend-managed template once Step 2 save flow is implemented. */}
            </div>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <a href={iamPoliciesConsoleUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="h-10 cursor-pointer rounded-md border-[color:var(--border-light)]">
                Open AWS IAM Policies
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Button>
            </a>
          </div>
        </section>

        <section className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-text-primary">2.2 Create IAM Role Using Custom Trust Policy</h4>
            <p className="text-sm leading-6 text-text-secondary">
              Create the IAM role with <span className="font-semibold text-text-primary">Custom trust policy</span>, then paste the trust JSON below.
            </p>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Quick steps in AWS</p>
            <ol className="mt-2 space-y-1.5 text-sm leading-6 text-text-secondary">
              <li>1. In AWS IAM, select <span className="font-semibold text-text-primary">Create role</span>.</li>
              <li>2. Choose <span className="font-semibold text-text-primary">Custom trust policy</span>.</li>
              <li>3. Paste the trust policy JSON from KCX below.</li>
              <li>4. Continue to permissions and attach all required policies listed below before finishing the role.</li>
            </ol>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Trust policy JSON</p>
            <p className="text-sm leading-6 text-text-secondary">
              Paste this JSON into AWS when selecting custom trust policy.
            </p>
          </div>

          {generatedTrustPolicy && showGeneratedTrustPolicy ? (
            <pre className="overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs leading-5 text-text-secondary">
{generatedTrustPolicy}
            </pre>
          ) : generatedTrustPolicy ? (
            <p className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs text-text-secondary">
              Trust policy is ready. Use <span className="font-medium text-text-primary">View Trust Policy JSON</span> to review it.
            </p>
          ) : (
            <p className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs text-text-secondary">
              Trust policy will appear once external ID is ready.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-3 text-xs"
              onClick={() => {
                void handleCopyTrustPolicy()
              }}
              disabled={!generatedTrustPolicy}
            >
              {copiedTrustPolicy ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copiedTrustPolicy ? "Copied trust policy" : "Copy trust policy JSON"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-3 text-xs"
              onClick={() => setShowGeneratedTrustPolicy((prev) => !prev)}
              disabled={!generatedTrustPolicy}
            >
              {showGeneratedTrustPolicy ? "Hide Trust Policy JSON" : "View Trust Policy JSON"}
            </Button>
          </div>
          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <a href={iamConsoleUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="h-10 cursor-pointer rounded-md border-[color:var(--border-light)]">
                Open AWS IAM Console
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Button>
            </a>
          </div>
          <div className="border-t border-[color:var(--border-light)] pt-4">
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-text-primary">Attach Required Permissions Before Finalizing the Role</h5>
              <p className="text-sm leading-6 text-text-secondary">
                During role creation, attach all three required policies before completing the role.
              </p>
              <div className="space-y-2">
                {managedPolicies.map((policy) => (
                  <div
                    key={policy.key}
                    className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2"
                  >
                    <p className="text-sm font-medium text-text-primary">{policy.name}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 rounded-md px-2 text-xs"
                      onClick={() => {
                        void handleCopyManagedPolicy(policy.key, policy.name)
                      }}
                    >
                      {copiedManagedPolicy === policy.key ? (
                        <Check className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copiedManagedPolicy === policy.key ? "Copied" : "Copy"}
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2">
                  <p className="text-sm font-medium text-text-primary">
                    {customPolicyName.trim() || "Custom policy name from Step 2.1"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto h-7 rounded-md px-2 text-xs"
                    onClick={() => {
                      void handleCopyCustomPolicyName()
                    }}
                    disabled={!customPolicyName.trim()}
                  >
                    {copiedCustomPolicyName ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    {copiedCustomPolicyName ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-text-secondary">
                Required set: AWSBillingReadOnlyAccess, ViewOnlyAccess, and your custom S3 policy from Step 2.1.
              </p>
            </div>
          </div>
          {/* TODO: Replace local external-id persistence with backend-issued stable external IDs. */}
        </section>

        <section className="space-y-3 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <h4 className="text-base font-semibold text-text-primary">2.3 Confirm AWS Resource Names</h4>
          <p className="text-sm leading-6 text-text-secondary">
            Enter the exact IAM role name created in AWS, then continue to Step 3 in KCX.
          </p>
          <div className="grid gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">IAM Role Name</span>
              <input
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="e.g. KCXBillingReadRole"
                value={roleName}
                onChange={(event) => onRoleNameChange(event.target.value)}
              />
            </label>
            <p className="text-xs text-text-secondary">
              Ensure role creation is complete in AWS before proceeding.
            </p>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

export const AWS_MANUAL_EXPLORER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/explorer(?:\/|$)/
function AwsLoginSection() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">1.1 Access AWS Billing Console</h4>
        <p className="text-sm text-text-secondary">
          Open AWS Billing and navigate to Data Exports to create a new export.
        </p>
      </div>
      <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Quick steps</p>
        <ol className="mt-2 space-y-1.5 text-sm leading-6 text-text-secondary">
          <li>1. Open AWS Billing Console.</li>
          <li>2. Navigate to <span className="font-semibold text-text-primary">Data Exports</span>.</li>
          <li>3. Start creating a new standard export.</li>
        </ol>
      </div>
    </section>
  )
}

function ConfigureExportSection({
  bucketName,
  pathPrefix,
  onBucketNameChange,
  onPathPrefixChange,
  showBucketFormatHint,
}: {
  bucketName: string
  pathPrefix: string
  onBucketNameChange: (value: string) => void
  onPathPrefixChange: (value: string) => void
  showBucketFormatHint: boolean
}) {
  const billingConsoleUrl = "https://console.aws.amazon.com/costmanagement/home#/bcm-data-exports"

  const requiredConfiguration = [
    { label: "Export type", value: "Standard data export" },
    { label: "Data table", value: "FOCUS with AWS columns" },
    { label: "Schema version", value: "FOCUS 1.2" },
    { label: "Time granularity", value: "Hourly" },
    { label: "File format", value: "gzip (CSV)" },
  ]

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">1.2 Configure Billing Data Export</h4>
        <p className="text-sm text-text-secondary">
          While creating the export in AWS, use the following required configuration.
        </p>
      </div>

      <div className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-text-primary">Required Configuration</h5>
          <div className="rounded-md border border-[color:var(--border-light)]">
            {requiredConfiguration.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-1 gap-1 px-4 py-3 text-sm md:grid-cols-[220px_minmax(0,1fr)] md:items-center",
                  index < requiredConfiguration.length - 1 ? "border-b border-[color:var(--border-light)]" : ""
                )}
              >
                <p className="text-text-secondary">{row.label}</p>
                <p className="font-medium text-text-primary md:text-right">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-text-primary">File versioning</h5>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">First-time setup</p>
                <p className="mt-1 text-sm font-medium text-text-primary">Create new export</p>
              </div>
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Existing export</p>
                <p className="mt-1 text-sm font-medium text-text-primary">Overwrite existing</p>
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              Choose overwrite only if you are reconfiguring an existing export.
            </p>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-text-primary">Storage Configuration</h5>
            <div className="space-y-3.5">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text-primary">S3 Bucket</p>
                <p className="text-sm leading-6 text-text-secondary">
                  Specify the S3 bucket where AWS will deliver your billing data export.
                </p>
                <input
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                  placeholder="e.g. company-billing-export"
                  value={bucketName}
                  onChange={(event) => onBucketNameChange(event.target.value)}
                />
                <p className="text-xs text-text-secondary">e.g. company-billing-export</p>
                {showBucketFormatHint ? (
                  <p className="text-xs text-text-secondary">Bucket names should not contain spaces.</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text-primary">S3 Path Prefix</p>
                <p className="text-sm leading-6 text-text-secondary">
                  Optional: Define a folder path inside the bucket (e.g., billing-reports/).
                </p>
                <input
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                  placeholder="Optional folder prefix"
                  value={pathPrefix}
                  onChange={(event) => onPathPrefixChange(event.target.value)}
                />
                <p className="text-xs text-text-secondary">
                  Example: billing-reports/ or kcx-exports/monthly/
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <div className="space-y-1 rounded-md border-l-2 border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] px-3 py-2.5">
            <p className="text-xs font-medium text-text-primary">Do not use Parquet format.</p>
            <p className="text-xs font-medium text-text-primary">Ensure FOCUS 1.2 is selected.</p>
            <p className="text-xs font-medium text-text-primary">Hourly granularity is required.</p>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <a href={billingConsoleUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">
              Open AWS Billing Console
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  )
}

type ManualSetupStepThreeProps = {
  connectionName: string
  dataExportName: string
  roleArn: string
  expectedAccountId: string
  onConnectionNameChange: (value: string) => void
  onDataExportNameChange: (value: string) => void
  onRoleArnChange: (value: string) => void
  onExpectedAccountIdChange: (value: string) => void
  roleNameHint: string
}

function ManualSetupStepThree({
  connectionName,
  dataExportName,
  roleArn,
  expectedAccountId,
  onConnectionNameChange,
  onDataExportNameChange,
  onRoleArnChange,
  onExpectedAccountIdChange,
  roleNameHint,
}: ManualSetupStepThreeProps) {
  const generatedRoleArnPreview =
    expectedAccountId.trim().length === 12 && /^\d{12}$/.test(expectedAccountId.trim()) && roleNameHint.trim().length > 0
      ? `arn:aws:iam::${expectedAccountId.trim()}:role/${roleNameHint.trim()}`
      : ""

  return (
    <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">STEP 3</p>
          <h3 className="text-lg font-semibold text-text-primary">Confirm Connection Details</h3>
          <p className="text-sm leading-6 text-text-secondary">
            Final confirmation: review and enter the exact AWS values to complete this connection.
          </p>
        </div>

        <div className="border-t border-[color:var(--border-light)]" />

        <section className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-text-primary">3.1 Final Confirmation Inputs</h4>
            <p className="text-sm text-text-secondary">
              Enter the exact AWS resource values created in Steps 1 and 2.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Connection Name</span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="ex: kcx-cz-30-march"
              value={connectionName}
              onChange={(event) => onConnectionNameChange(event.target.value)}
            />
            <p className="text-xs text-text-secondary">
              This name helps you identify this AWS connection inside KCX.
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Data Export Name</span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="ex: billing-export-march"
              value={dataExportName}
              onChange={(event) => onDataExportNameChange(event.target.value)}
            />
            <p className="text-xs text-text-secondary">
              Use the exact export name created in AWS Billing Data Exports during Step 1.
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">
              AWS Account ID
            </span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="123456789012"
              value={expectedAccountId}
              onChange={(event) => onExpectedAccountIdChange(event.target.value)}
            />
            <p className="text-xs text-text-secondary">
              Enter your 12-digit AWS account ID to generate the role ARN automatically.
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">
              Cross-Account IAM Role ARN
            </span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="arn:aws:iam::123456789012:role/example-role-name"
              value={roleArn}
              onChange={(event) => onRoleArnChange(event.target.value)}
            />
            {generatedRoleArnPreview ? (
              <p className="text-xs text-text-secondary">
                Suggested ARN: <span className="font-medium text-text-primary">{generatedRoleArnPreview}</span>
              </p>
            ) : null}
            {roleNameHint ? (
              <p className="text-xs text-text-secondary">
                Step 2 role name entered: <span className="font-medium text-text-primary">{roleNameHint}</span>
              </p>
            ) : null}
            <p className="text-xs text-text-secondary">
              Enter the full ARN of the IAM role created in Step 2.
            </p>
          </label>
        </section>
      </CardContent>
    </Card>
  )
}

function ManualSetupProgress({
  isStep1Complete,
  isStep2Complete,
  isStep3Complete,
}: {
  isStep1Complete: boolean
  isStep2Complete: boolean
  isStep3Complete: boolean
}) {
  const steps = [
    {
      key: "step-1",
      label: "Billing Export",
      state: isStep1Complete ? "complete" : "active",
    },
    {
      key: "step-2",
      label: "IAM Setup",
      state: !isStep1Complete ? "locked" : isStep2Complete ? "complete" : "active",
    },
    {
      key: "step-3",
      label: "Finalize",
      state: !isStep2Complete ? "locked" : isStep3Complete ? "complete" : "active",
    },
  ] as const

  return (
    <div className="sticky top-4 z-20 rounded-md border border-[color:var(--border-light)] bg-white/95 px-2 py-2.5 shadow-sm backdrop-blur">
      <div className="grid grid-cols-3 divide-x divide-[color:var(--border-light)]">
        {steps.map((step) => (
          <div key={step.key} className="px-3">
            <div
              className={cn(
                "border-b-2 pb-2",
                step.state === "active"
                  ? "border-brand-primary"
                  : step.state === "complete"
                    ? "border-emerald-500"
                    : "border-[color:var(--border-light)]",
              )}
            >
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.04em]",
                  step.state === "active"
                    ? "text-brand-primary"
                    : step.state === "complete"
                      ? "text-emerald-700"
                      : "text-text-secondary",
                )}
              >
                {step.state === "locked" ? "Locked" : step.state === "complete" ? "Complete" : "In progress"}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm leading-5",
                  step.state === "active"
                    ? "font-semibold text-text-primary"
                    : step.state === "complete"
                      ? "font-medium text-text-primary"
                      : "font-medium text-text-secondary",
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewValueRow({ label, value }: { label: string; value: string | null }) {
  const safeValue = value && value.trim().length > 0 ? value : "Not provided"

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[color:var(--border-light)] px-4 py-3 text-sm last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
      <p className="text-text-secondary">{label}</p>
      <p className="break-words font-medium text-text-primary md:text-right">{safeValue}</p>
    </div>
  )
}

function mapValidationErrorMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("access denied")) return "Validation failed: access denied for the provided AWS role or bucket."
  if (normalized.includes("assume") || normalized.includes("sts")) return "Validation failed: unable to assume the AWS IAM role."
  if (normalized.includes("external")) return "Validation failed: external ID does not match the IAM trust configuration."
  if (normalized.includes("bucket") || normalized.includes("s3")) return "Validation failed: unable to access the configured S3 bucket or prefix."
  if (normalized.includes("arn")) return "Validation failed: the IAM role ARN appears to be invalid."
  return message || "Validation failed. Review the configuration and try again."
}

type ApiErrorPayload = {
  message?: string
  error?: {
    code?: string
    details?: {
      provider?: string
      awsAccountId?: string
    }
  }
}

function getApiErrorPayload(error: ApiError): ApiErrorPayload | null {
  if (!error.payload || typeof error.payload !== "object") return null
  return error.payload as ApiErrorPayload
}

function isDuplicateCloudConnectionError(error: ApiError): boolean {
  const payload = getApiErrorPayload(error)
  const code = payload?.error?.code
  if (error.status === 409 && code === "DUPLICATE_CLOUD_CONNECTION") return true
  return Boolean(error.message && error.message.toLowerCase().includes("already connected"))
}

function normalizeExplorerPrefix(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, "")
  if (!trimmed) return ""
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

function formatFileSize(size: number | null): string {
  if (size === null || Number.isNaN(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatLastModified(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function AwsBucketBrowserPage({
  bucketName,
  rootPrefix,
  currentPrefix,
  items,
  isLoading,
  errorMessage,
  callerAccount,
  onOpenPrefix,
  onReload,
}: {
  bucketName: string
  rootPrefix: string
  currentPrefix: string
  items: AwsManualBrowseBucketItem[]
  isLoading: boolean
  errorMessage: string | null
  callerAccount: string | null
  onOpenPrefix: (prefix: string) => void
  onReload: () => void
}) {
  const normalizedCurrentPrefix = normalizeExplorerPrefix(currentPrefix)
  const breadcrumbParts = normalizedCurrentPrefix
    .split("/")
    .filter((segment) => segment.length > 0)

  const folderItems = items.filter((item) => item.type === "folder")
  const fileItems = items.filter((item) => item.type === "file")
  const sortedItems = [...folderItems, ...fileItems]

  return (
    <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
      <CardContent className="p-0">
        <div className="border-b border-[color:var(--border-light)] bg-[linear-gradient(160deg,#0f2b24_0%,#1b3f35_58%,#25574b_100%)] px-6 py-5 text-white">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Browse Connected Billing Bucket</h3>
            <p className="text-sm text-white/85">
              Connection validated successfully. Review the contents of the connected S3 export path.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/85">
            <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">Bucket: {bucketName}</span>
            <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">
              Root Prefix: {normalizeExplorerPrefix(rootPrefix) || "/"}
            </span>
            {callerAccount ? (
              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">Account: {callerAccount}</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
            <div className="flex flex-wrap items-center gap-1 text-xs text-text-secondary">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 font-medium text-brand-primary hover:bg-[color:var(--highlight-green)]"
                onClick={() => onOpenPrefix("")}
              >
                bucket root
              </button>
              {breadcrumbParts.map((part, index) => {
                const targetPrefix = `${breadcrumbParts.slice(0, index + 1).join("/")}/`
                return (
                  <div key={targetPrefix} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 font-medium text-brand-primary hover:bg-[color:var(--highlight-green)]"
                      onClick={() => onOpenPrefix(targetPrefix)}
                    >
                      {part}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-[color:var(--border-light)]">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_180px_120px] bg-[color:var(--bg-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              <p>Name</p>
              <p>Type</p>
              <p>Last Modified</p>
              <p className="text-right">Size</p>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading bucket contents...
              </div>
            ) : errorMessage ? (
              <div className="flex items-start gap-2 px-4 py-4 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p>{errorMessage}</p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="px-4 py-8 text-sm text-text-secondary">No objects found in this path.</div>
            ) : (
              <div className="divide-y divide-[color:var(--border-light)]">
                {sortedItems.map((item) => (
                  <div
                    key={`${item.type}:${item.key}`}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_120px_180px_120px] items-center gap-2 px-4 py-3 text-sm",
                      item.type === "folder" ? "bg-white" : "bg-[color:var(--bg-surface)]",
                    )}
                  >
                    <div className="min-w-0">
                      {item.type === "folder" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-left font-medium text-brand-primary hover:underline"
                          onClick={() => onOpenPrefix(item.path)}
                        >
                          <Folder className="h-4 w-4" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-text-primary">
                          <FileText className="h-4 w-4 text-text-muted" />
                          <span className="truncate">{item.name}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-text-secondary">{item.type}</p>
                    <p className="text-text-secondary">{formatLastModified(item.lastModified)}</p>
                    <p className="text-right text-text-secondary">{item.type === "folder" ? "-" : formatFileSize(item.size)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-light)] pt-2">
            <Button type="button" variant="outline" className="h-10 rounded-md" onClick={onReload} disabled={isLoading}>
              Reload
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AwsSetupReviewValidation({
  bucketName,
  pathPrefix,
  externalId,
  roleName,
  customPolicyName,
  connectionName,
  dataExportName,
  roleArn,
  onBackToEdit,
  onContinue,
  validateStatus,
  validationMessage,
}: {
  bucketName: string
  pathPrefix: string
  externalId: string
  roleName: string
  customPolicyName: string
  connectionName: string
  dataExportName: string
  roleArn: string
  onBackToEdit: () => void
  onContinue: () => void
  validateStatus: "idle" | "validating" | "success" | "failure"
  validationMessage: string | null
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="space-y-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Review & Validate</p>
          <h3 className="text-lg font-semibold text-text-primary">Review AWS Connection Configuration</h3>
          <p className="text-sm text-text-secondary">
            Confirm the setup values below, then run a live connection validation.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="px-4 py-3">
            <h4 className="text-sm font-semibold text-text-primary">Billing Data Export</h4>
          </div>
          <div className="border-t border-[color:var(--border-light)]">
            <ReviewValueRow label="S3 Bucket Name" value={bucketName} />
            <ReviewValueRow label="S3 Prefix" value={pathPrefix} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="px-4 py-3">
            <h4 className="text-sm font-semibold text-text-primary">IAM Configuration</h4>
          </div>
          <div className="border-t border-[color:var(--border-light)]">
            <ReviewValueRow label="External ID" value={externalId} />
            <ReviewValueRow label="IAM Role Name" value={roleName} />
            <ReviewValueRow label="Custom Policy Name" value={customPolicyName} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="px-4 py-3">
            <h4 className="text-sm font-semibold text-text-primary">Final Connection Details</h4>
          </div>
          <div className="border-t border-[color:var(--border-light)]">
            <ReviewValueRow label="Connection Name" value={connectionName} />
            <ReviewValueRow label="Data Export Name" value={dataExportName} />
            <ReviewValueRow label="Role ARN" value={roleArn} />
          </div>
        </CardContent>
      </Card>

      {validateStatus === "validating" ? (
        <div className="rounded-md border border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] p-4 text-sm text-text-primary">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Validating connection...</span>
          </div>
        </div>
      ) : null}

      {validateStatus === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <p>{validationMessage ?? "Validation successful. Connection is active."}</p>
          </div>
        </div>
      ) : null}

      {validateStatus === "failure" ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <p>{validationMessage ?? "Validation failed. Review your configuration and retry."}</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-md border-[color:var(--border-light)]"
          onClick={onBackToEdit}
          disabled={validateStatus === "validating"}
        >
          Edit Configuration
        </Button>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium",
              validateStatus === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : validateStatus === "failure"
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary",
            )}
          >
            {validateStatus === "success" ? "Validation: Success" : validateStatus === "failure" ? "Validation: Failure" : "Validation: Pending"}
          </span>
          <Button
            type="button"
            className="h-10 rounded-md"
            onClick={onContinue}
            disabled={validateStatus !== "success"}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AwsManualSetup({ activeRoute }: { activeRoute: string }) {
  const authUser = getAuthUser()
  const manualBaseRoute = activeRoute.startsWith("/client/billing/connections/")
    ? "/client/billing/connections/aws/manual"
    : "/client/billing/connect-cloud/aws/manual"
  const successRoute = `${manualBaseRoute}/success`
  const isExplorerRoute = AWS_MANUAL_EXPLORER_ROUTE_REGEX.test(activeRoute)

  const [viewMode, setViewMode] = useState<"setup" | "review">("setup")
  const [bucketName, setBucketName] = useState("")
  const [pathPrefix, setPathPrefix] = useState("")
  const [externalId, setExternalId] = useState("")
  const [roleName, setRoleName] = useState("")
  const [customPolicyName, setCustomPolicyName] = useState("")
  const [connectionName, setConnectionName] = useState("")
  const [dataExportName, setDataExportName] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [expectedAccountId, setExpectedAccountId] = useState("")
  const [finishError, setFinishError] = useState<string | null>(null)
  const [isSubmittingFinish, setIsSubmittingFinish] = useState(false)
  const [validateStatus, setValidateStatus] = useState<"idle" | "validating" | "success" | "failure">("idle")
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [validatedAccountId, setValidatedAccountId] = useState<string | null>(null)
  const [bucketBrowsePrefix, setBucketBrowsePrefix] = useState("")
  const [bucketBrowseItems, setBucketBrowseItems] = useState<AwsManualBrowseBucketItem[]>([])
  const [bucketBrowseError, setBucketBrowseError] = useState<string | null>(null)
  const [isBucketBrowseLoading, setIsBucketBrowseLoading] = useState(false)

  const flowStorageKey = useMemo(
    () => `kcx_aws_manual_flow_user_${authUser?.id ?? "anonymous"}`,
    [authUser?.id],
  )

  useEffect(() => {
    const existing = localStorage.getItem(flowStorageKey)
    if (!existing) return

    try {
      const parsed = JSON.parse(existing) as {
        bucketName?: string
        pathPrefix?: string
        externalId?: string
        roleName?: string
        customPolicyName?: string
        connectionName?: string
        dataExportName?: string
        roleArn?: string
        expectedAccountId?: string
      }
      setBucketName(typeof parsed.bucketName === "string" ? parsed.bucketName : "")
      setPathPrefix(typeof parsed.pathPrefix === "string" ? parsed.pathPrefix : "")
      setExternalId(typeof parsed.externalId === "string" ? parsed.externalId : "")
      setRoleName(typeof parsed.roleName === "string" ? parsed.roleName : "")
      setCustomPolicyName(typeof parsed.customPolicyName === "string" ? parsed.customPolicyName : "")
      setConnectionName(typeof parsed.connectionName === "string" ? parsed.connectionName : "")
      setDataExportName(typeof parsed.dataExportName === "string" ? parsed.dataExportName : "")
      setRoleArn(typeof parsed.roleArn === "string" ? parsed.roleArn : "")
      setExpectedAccountId(typeof parsed.expectedAccountId === "string" ? parsed.expectedAccountId : "")
    } catch {
      // Ignore malformed local storage payload.
    }
  }, [flowStorageKey])

  useEffect(() => {
    const payload = {
      bucketName: bucketName.trim(),
      pathPrefix: pathPrefix.trim(),
      externalId: externalId.trim(),
      roleName: roleName.trim(),
      customPolicyName: customPolicyName.trim(),
      connectionName: connectionName.trim(),
      dataExportName: dataExportName.trim(),
      roleArn: roleArn.trim(),
      expectedAccountId: expectedAccountId.trim(),
    }
    localStorage.setItem(flowStorageKey, JSON.stringify(payload))
  }, [bucketName, connectionName, customPolicyName, dataExportName, expectedAccountId, externalId, flowStorageKey, pathPrefix, roleArn, roleName])

  const hasBucketName = bucketName.trim().length > 0
  const hasNoSpacesInBucketName = !/\s/.test(bucketName)
  const showBucketFormatHint = hasBucketName && !hasNoSpacesInBucketName

  const isStep1Complete = hasBucketName && hasNoSpacesInBucketName
  const isStep2Complete = roleName.trim().length > 0 && customPolicyName.trim().length > 0
  const isStep3Complete = connectionName.trim().length > 0 && dataExportName.trim().length > 0 && roleArn.trim().length > 0
  const isAllComplete = isStep1Complete && isStep2Complete && isStep3Complete

  useEffect(() => {
    if (roleArn.trim().length > 0) return
    const normalizedAccountId = expectedAccountId.trim()
    const normalizedRoleName = roleName.trim()
    if (!/^\d{12}$/.test(normalizedAccountId)) return
    if (!normalizedRoleName) return
    setRoleArn(`arn:aws:iam::${normalizedAccountId}:role/${normalizedRoleName}`)
  }, [expectedAccountId, roleArn, roleName])

  async function handleFinishSetup() {
    if (!isAllComplete || isSubmittingFinish) return

    setFinishError(null)
    setValidatedAccountId(null)
    setIsSubmittingFinish(true)

    try {
      const normalizedExternalId = externalId.trim()
      const externalIdStorageKey = `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`
      const fallbackExternalId = localStorage.getItem(externalIdStorageKey)?.trim() ?? ""
      const externalIdForSubmit = normalizedExternalId || fallbackExternalId

      if (!externalIdForSubmit) {
        throw new Error("External ID is missing. Return to Step 2 and regenerate it.")
      }

      if (!normalizedExternalId && fallbackExternalId) {
        setExternalId(fallbackExternalId)
      }

      const result = await testAwsManualConnection({
        connectionName: connectionName.trim(),
        reportName: dataExportName.trim(),
        roleArn: roleArn.trim(),
        externalId: externalIdForSubmit,
        bucketName: bucketName.trim(),
        ...(pathPrefix.trim().length > 0 ? { prefix: pathPrefix.trim() } : {}),
      })

      setValidateStatus(result.success ? "success" : "failure")
      setValidatedAccountId(result.accountId ?? null)
      setValidationMessage(
        result.success
          ? `AssumeRole succeeded. Account: ${result.accountId ?? "unknown"}`
          : mapValidationErrorMessage("Connection validation failed."),
      )
      setViewMode("review")
    } catch (error) {
      setValidatedAccountId(null)
      console.error("[AWS Manual Setup][Finish Setup] Failed", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      })
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setFinishError("Your session appears expired. Please log in again, then retry validation.")
          return
        }
        if (isDuplicateCloudConnectionError(error)) {
          setFinishError("This AWS account is already connected in KCX.")
          return
        }
        setFinishError(error.message || "Could not prepare connection for validation.")
      } else if (error instanceof Error) {
        setFinishError(error.message)
      } else {
        setFinishError("Could not prepare connection for validation.")
      }
    } finally {
      setIsSubmittingFinish(false)
    }
  }

  async function loadBucketContents(targetPrefix?: string) {
    if (isBucketBrowseLoading) return

    const normalizedExternalId = externalId.trim()
    const externalIdStorageKey = `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`
    const fallbackExternalId = localStorage.getItem(externalIdStorageKey)?.trim() ?? ""
    const externalIdForSubmit = normalizedExternalId || fallbackExternalId

    if (!externalIdForSubmit) {
      setBucketBrowseError("External ID is missing. Return to Step 2 and regenerate it.")
      return
    }

    const effectivePrefix =
      typeof targetPrefix === "string" ? targetPrefix : bucketBrowsePrefix || normalizeExplorerPrefix(pathPrefix)

    setIsBucketBrowseLoading(true)
    setBucketBrowseError(null)

    try {
      const result = await browseAwsManualBucket({
        roleArn: roleArn.trim(),
        externalId: externalIdForSubmit,
        bucketName: bucketName.trim(),
        prefix: effectivePrefix,
      })

      setBucketBrowsePrefix(result.prefix)
      setBucketBrowseItems(result.items)
      setBucketBrowseError(null)
      if (result.callerIdentity?.account) {
        setValidatedAccountId(result.callerIdentity.account)
      }
    } catch (error) {
      console.error("[AWS Manual Setup][Browse Bucket] Failed", {
        bucketName: bucketName.trim(),
        prefix: effectivePrefix,
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      })
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setBucketBrowseError("Your session appears expired. Please log in again, then retry.")
          return
        }
        setBucketBrowseError(error.message || "Could not load S3 bucket contents.")
      } else {
        setBucketBrowseError("Could not load S3 bucket contents.")
      }
    } finally {
      setIsBucketBrowseLoading(false)
    }
  }

  function handleContinueToSuccessPage() {
    localStorage.removeItem(flowStorageKey)
    navigateTo(successRoute)
  }

  useEffect(() => {
    if (!isExplorerRoute) return
    if (isBucketBrowseLoading) return
    if (bucketBrowseItems.length > 0) return
    const startPrefix = bucketBrowsePrefix || normalizeExplorerPrefix(pathPrefix)
    void loadBucketContents(startPrefix)
  }, [bucketBrowseError, bucketBrowseItems.length, bucketBrowsePrefix, isBucketBrowseLoading, isExplorerRoute, pathPrefix])

  if (viewMode === "review" && isExplorerRoute) {
    return (
      <div className="space-y-5">
        <div className="flex justify-start">
          <Button type="button" variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]" onClick={() => navigateTo(manualBaseRoute)}>
            Back to Review
          </Button>
        </div>
        <AwsBucketBrowserPage
          bucketName={bucketName.trim()}
          rootPrefix={pathPrefix.trim()}
          currentPrefix={bucketBrowsePrefix}
          items={bucketBrowseItems}
          isLoading={isBucketBrowseLoading}
          errorMessage={bucketBrowseError}
          callerAccount={validatedAccountId}
          onOpenPrefix={(nextPrefix) => {
            void loadBucketContents(nextPrefix)
          }}
          onReload={() => {
            void loadBucketContents(bucketBrowsePrefix || normalizeExplorerPrefix(pathPrefix))
          }}
        />
      </div>
    )
  }

  if (viewMode === "review") {
    return (
      <div className="space-y-5">
        <AwsSetupReviewValidation
          bucketName={bucketName.trim()}
          pathPrefix={pathPrefix.trim()}
          externalId={externalId.trim()}
          roleName={roleName.trim()}
          customPolicyName={customPolicyName.trim()}
          connectionName={connectionName.trim()}
          dataExportName={dataExportName.trim()}
          roleArn={roleArn.trim()}
          onBackToEdit={() => {
            setViewMode("setup")
          }}
          onContinue={() => {
            handleContinueToSuccessPage()
          }}
          validateStatus={validateStatus}
          validationMessage={validationMessage}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ManualSetupProgress
        isStep1Complete={isStep1Complete}
        isStep2Complete={isStep2Complete}
        isStep3Complete={isStep3Complete}
      />

      <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
        <CardContent className="space-y-7 p-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-text-secondary">Step 1</p>
            <h3 className="text-lg font-semibold text-text-primary">Prepare your billing data</h3>
            <p className="text-sm leading-6 text-text-secondary">
              Configure your AWS Billing Data Export using the exact settings required by KCX.
            </p>
          </div>
          <div className="border-t border-[color:var(--border-light)]" />
          <AwsLoginSection />
          <div className="border-t border-[color:var(--border-light)]" />
          <ConfigureExportSection
            bucketName={bucketName}
            pathPrefix={pathPrefix}
            onBucketNameChange={setBucketName}
            onPathPrefixChange={setPathPrefix}
            showBucketFormatHint={showBucketFormatHint}
          />
          {isStep1Complete ? <p className="text-sm text-text-secondary">Step 1 complete.</p> : null}
        </CardContent>
      </Card>

      <div className={cn("transition-opacity", !isStep1Complete ? "pointer-events-none opacity-60" : "")}>
        <AwsManualSetupStepTwo
          roleName={roleName}
          customPolicyName={customPolicyName}
          onRoleNameChange={setRoleName}
          onCustomPolicyNameChange={setCustomPolicyName}
          bucketNameHint={bucketName}
          onExternalIdChange={setExternalId}
        />
      </div>

      <div className={cn("transition-opacity", !isStep2Complete ? "pointer-events-none opacity-60" : "")}>
        <ManualSetupStepThree
          connectionName={connectionName}
          dataExportName={dataExportName}
          roleArn={roleArn}
          expectedAccountId={expectedAccountId}
          onConnectionNameChange={setConnectionName}
          onDataExportNameChange={setDataExportName}
          onRoleArnChange={setRoleArn}
          onExpectedAccountIdChange={setExpectedAccountId}
          roleNameHint={roleName.trim()}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-10 rounded-md"
          disabled={!isAllComplete || isSubmittingFinish}
          onClick={() => {
            void handleFinishSetup()
          }}
        >
          {isSubmittingFinish ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Testing connection...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
      </div>
      {finishError ? <p className="text-sm text-rose-700">{finishError}</p> : null}
    </div>
  )
}


