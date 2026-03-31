import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getAuthUser } from "@/lib/auth"
import { navigateTo } from "@/lib/navigation"
import { Check, Copy, ExternalLink, Eye, EyeOff } from "lucide-react"

const EXTERNAL_ID_LENGTH = 24

function generateExternalId(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

export function AwsManualSetupStepTwo() {
  const iamConsoleUrl = "https://console.aws.amazon.com/iam/home#/roles"
  const iamPoliciesConsoleUrl = "https://console.aws.amazon.com/iam/home#/policies"
  const [copiedAccountId, setCopiedAccountId] = useState(false)
  const [copiedExternalId, setCopiedExternalId] = useState(false)
  const [copiedManagedPolicy, setCopiedManagedPolicy] = useState<null | "billing" | "view">(null)
  const [copiedCustomPolicy, setCopiedCustomPolicy] = useState(false)
  const [externalId, setExternalId] = useState("")
  const [showExternalId, setShowExternalId] = useState(false)
  const [customPolicyBucketName, setCustomPolicyBucketName] = useState("")
  const [generatedCustomPolicy, setGeneratedCustomPolicy] = useState<string | null>(null)
  const [roleName, setRoleName] = useState("")
  const [customPolicyName, setCustomPolicyName] = useState("")

  const authUser = getAuthUser()
  const externalIdStorageKey = useMemo(
    () => `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`,
    [authUser?.id],
  )
  const resourceNamesStorageKey = useMemo(
    () => `kcx_aws_manual_resource_names_user_${authUser?.id ?? "anonymous"}`,
    [authUser?.id],
  )

  useEffect(() => {
    const existing = localStorage.getItem(externalIdStorageKey)
    if (existing && existing.length === EXTERNAL_ID_LENGTH) {
      setExternalId(existing)
      return
    }

    const nextExternalId = generateExternalId(EXTERNAL_ID_LENGTH)
    localStorage.setItem(externalIdStorageKey, nextExternalId)
    setExternalId(nextExternalId)
  }, [externalIdStorageKey])

  useEffect(() => {
    const existing = localStorage.getItem(resourceNamesStorageKey)
    if (!existing) return

    try {
      const parsed = JSON.parse(existing) as { roleName?: string; customPolicyName?: string }
      if (typeof parsed.roleName === "string") {
        setRoleName(parsed.roleName)
      }
      if (typeof parsed.customPolicyName === "string") {
        setCustomPolicyName(parsed.customPolicyName)
      }
    } catch {
      // Ignore malformed local storage payload.
    }
  }, [resourceNamesStorageKey])

  useEffect(() => {
    const payload = {
      roleName: roleName.trim(),
      customPolicyName: customPolicyName.trim(),
    }
    localStorage.setItem(resourceNamesStorageKey, JSON.stringify(payload))
  }, [customPolicyName, resourceNamesStorageKey, roleName])

  const managedPolicies = [
    { key: "billing" as const, name: "AWSBillingReadOnlyAccess" },
    { key: "view" as const, name: "ViewOnlyAccess" },
  ]

  function buildCustomPolicyJson(bucketName: string) {
    return JSON.stringify(
      {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "KCXBillingBucketListAccess",
            Effect: "Allow",
            Action: ["s3:ListBucket"],
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

  async function handleCopyAccountId() {
    try {
      await navigator.clipboard.writeText("275017715736")
      setCopiedAccountId(true)
      window.setTimeout(() => setCopiedAccountId(false), 1500)
    } catch {
      setCopiedAccountId(false)
    }
  }

  async function handleCopyExternalId() {
    if (!externalId) return

    try {
      await navigator.clipboard.writeText(externalId)
      setCopiedExternalId(true)
      window.setTimeout(() => setCopiedExternalId(false), 1500)
    } catch {
      setCopiedExternalId(false)
    }
  }

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

  function handleGenerateCustomPolicy() {
    const bucketName = customPolicyBucketName.trim()
    if (!bucketName) return
    setGeneratedCustomPolicy(buildCustomPolicyJson(bucketName))
  }

  const canProceedToStep3 = roleName.trim().length > 0 && customPolicyName.trim().length > 0

  return (
    <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">STEP 2</p>
          <h3 className="text-lg font-semibold text-text-primary">Configure Cross-Account Access</h3>
          <p className="text-sm text-text-secondary">
            Create an IAM role in your AWS account to allow KCX read-only access.
          </p>
        </div>

        <div className="border-t border-[color:var(--border-light)]" />

        <section className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-text-primary">2.1 Start IAM Role Setup</h4>
            <p className="text-sm text-text-secondary">
              We&apos;ll guide you through creating a role in AWS. Just follow along.
            </p>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <a href={iamConsoleUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="h-10 cursor-pointer rounded-md border-[color:var(--border-light)]">
                Open AWS IAM Console
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Button>
            </a>
          </div>

          <h4 className="text-sm font-semibold text-text-primary">KCX Details</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">KCX Account ID</p>
              <div className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2">
                <p className="text-sm text-text-primary">275017715736</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7 rounded-md px-2 text-xs"
                  onClick={() => {
                    void handleCopyAccountId()
                  }}
                >
                  {copiedAccountId ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                  {copiedAccountId ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">External ID</p>
              <div className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2">
                <p className="text-sm text-text-primary">
                  {externalId ? (showExternalId ? externalId : "*".repeat(externalId.length)) : "Generating..."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto h-7 w-7 rounded-md border border-[color:var(--border-light)] bg-[#0F1F1A] p-0 text-white hover:bg-[#152F28] hover:text-white"
                  onClick={() => setShowExternalId((prev) => !prev)}
                  disabled={!externalId}
                  aria-label={showExternalId ? "Hide external ID" : "Show external ID"}
                >
                  {showExternalId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-md px-2 text-xs"
                  onClick={() => {
                    void handleCopyExternalId()
                  }}
                  disabled={!externalId}
                >
                  {copiedExternalId ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                  {copiedExternalId ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
          {/* TODO: Replace local external-id persistence with backend-issued stable external IDs. */}

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Quick steps in AWS</p>
            <ol className="mt-2 space-y-1.5 text-sm text-text-secondary">
              <li>
                1. Choose <span className="font-semibold text-text-primary">AWS account</span> for trusted entity.
              </li>
              <li>
                2. Select <span className="font-semibold text-text-primary">Another AWS account</span>.
              </li>
              <li>
                3. Paste the <span className="font-semibold text-text-primary">KCX Account ID</span> from above.
              </li>
              <li>
                4. Turn on <span className="font-semibold text-text-primary">External ID</span> and paste the value from above.
              </li>
            </ol>
          </div>
        </section>

        <section className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-text-primary">Step 2.2 - Add Required Permissions</h4>
            <p className="text-sm text-text-secondary">
              Attach these managed policies to the role you created above. Then generate the bucket-scoped policy below, create it in AWS as a custom policy, and attach it to the same role.
            </p>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <a href={iamPoliciesConsoleUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="h-10 cursor-pointer rounded-md border-[color:var(--border-light)]">
                Open AWS IAM Policies
                <ExternalLink className="ml-1.5 h-4 w-4" />
              </Button>
            </a>
          </div>

          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-sm text-text-secondary">
              1) Attach both AWS managed policies below. 2) Generate and copy the KCX policy JSON. 3) Create it as a custom IAM policy in AWS. 4) Attach it to the same role.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">AWS managed policies</p>
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
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">KCX custom policy</p>
            <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-sm font-semibold text-text-primary">KCX Custom S3 Access Policy</p>
              <p className="mt-1 text-sm text-text-secondary">
                Enter the same billing export bucket name from Step 1.
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                KCX generates the JSON policy. Copy it, create it in AWS as a custom IAM policy, then attach it to the same role from Step 2.1.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                <input
                  className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                  placeholder="e.g. company-billing-export"
                  value={customPolicyBucketName}
                  onChange={(event) => setCustomPolicyBucketName(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-md border-[color:var(--border-light)]"
                  onClick={handleGenerateCustomPolicy}
                  disabled={!customPolicyBucketName.trim()}
                >
                  Generate IAM Policy
                </Button>
              </div>

              {generatedCustomPolicy ? (
                <pre className="mt-3 overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-white p-3 text-xs leading-5 text-text-secondary">
{generatedCustomPolicy}
                </pre>
              ) : (
                <p className="mt-3 text-xs text-text-muted">
                  Generate policy JSON, copy it, create the custom policy in AWS, then attach it to your role.
                </p>
              )}
              <div className="mt-3">
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
              </div>
              {/* TODO: Optionally tighten scope further to a specific prefix once prefix-aware generation is enabled. */}
              {/* TODO: Bind generated policy to backend-managed template once Step 2 save flow is implemented. */}
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <h4 className="text-base font-semibold text-text-primary">2.3 Confirm AWS Resource Names</h4>
          <p className="text-sm text-text-secondary">
            Enter the exact role and custom policy names used in AWS so KCX can track and validate this connection.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">IAM Role Name</span>
              <input
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="e.g. KCXBillingReadRole"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Custom Policy Name</span>
              <input
                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="e.g. KCXBillingBucketReadPolicy"
                value={customPolicyName}
                onChange={(event) => setCustomPolicyName(event.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="h-10 rounded-md border-[color:var(--border-light)]"
            onClick={() => navigateTo("/client/billing/connections/aws/manual")}
          >
            Back to Step 1
          </Button>
          <Button
            className="h-10 rounded-md"
            disabled={!canProceedToStep3}
            onClick={() => navigateTo("/client/billing/connections/aws/manual/step-3")}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
