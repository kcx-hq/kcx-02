import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { completeAwsManualSetup } from "@/features/client-home/api/cloud-connections.api"
import { ApiError } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"
import { cn } from "@/lib/utils"

export const AWS_MANUAL_EXPLORER_ROUTE_REGEX =
  /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/manual\/explorer(?:\/|$)/

type ValidationState = "idle" | "loading" | "success" | "error"

type ManualSetupForm = {
  externalId: string
  connectionName: string
  kcxPrincipalArn: string
  fileEventCallbackUrl: string
  callbackToken: string
  awsAccountId: string
  awsRegion: string
  enableCloudTrail: boolean
  enableActionRole: boolean
  enableEc2Module: boolean
  useTagScopedAccess: boolean
  billingRoleArn: string
  actionRoleArn: string
  exportBucket: string
  exportPrefix: string
  exportRegion: string
  exportName: string
  exportArn: string
  fileEventLambdaArn: string
  eventBridgeRuleName: string
  cloudTrailBucket: string
  cloudTrailPrefix: string
  trailName: string
  cloudTrailLambdaArn: string
  cloudTrailRuleName: string
}

type DerivedValues = {
  billingRoleName: string
  actionRoleName: string
  exportBucketName: string
  cloudTrailBucketName: string
  exportPrefix: string
  cloudTrailPrefix: string
  exportName: string
  cloudTrailName: string
}

type GeneratedSnippet = {
  billingRoleTrustPolicy: string
  billingRolePermissionsPolicy: string
  exportBucketPolicy: string
  actionRoleTrustPolicy: string
  actionRoleBasePermissionsPolicy: string
  ec2ModulePolicy: string
  cloudTrailBucketPolicy: string
  billingLambdaFunctionCode: string
  billingLambdaEnvValues: string
  cloudTrailLambdaFunctionCode: string
  cloudTrailLambdaEnvValues: string
  billingEventBridgeParams: string
  cloudTrailEventBridgeParams: string
}

const STEPS = [
  "Setup Values",
  "Roles",
  "Billing Export",
  "File Event Automation",
  "CloudTrail (Optional)",
  "Verify & Finish",
] as const

const LABEL_CLASS = "text-[12px] font-semibold uppercase tracking-[0.08em] text-text-secondary"
const CONTROL_CLASS =
  "h-[38px] w-full rounded-[8px] border border-[color:var(--border-light)] bg-white px-3 text-sm text-text-primary outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
const SECTION_TITLE_CLASS = "text-sm font-semibold uppercase tracking-[0.08em] text-brand-primary"

function randomAlphaNumeric(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

function normalizeConnectionName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function buildNodeLambdaFunctionCode(input: {
  callbackUrl: string
  callbackToken: string
  prefix: string
  triggerType: "manifest_created" | "cloudtrail_object_created"
  sourceType: "aws_data_exports_cur2" | "aws_cloudtrail"
  schemaType: "cur2_custom" | "cloudtrail_json"
  cadence: "hourly" | "event_driven"
  matcherBody: string
}) {
  return `const https = require("https");
const { URL } = require("url");

const FILE_EVENT_CALLBACK_URL = process.env.FILE_EVENT_CALLBACK_URL || "${input.callbackUrl}";
const CALLBACK_TOKEN = process.env.CALLBACK_TOKEN || "${input.callbackToken}";
const ROLE_ARN = process.env.ROLE_ARN || "";
const ACCOUNT_ID = process.env.ACCOUNT_ID || "";
const REGION = process.env.REGION || process.env.AWS_REGION || "";
const PREFIX = process.env.PREFIX || "${input.prefix}";
const SOURCE_TYPE = process.env.SOURCE_TYPE || "${input.sourceType}";
const SCHEMA_TYPE = process.env.SCHEMA_TYPE || "${input.schemaType}";
const CADENCE = process.env.CADENCE || "${input.cadence}";

function decodeObjectKey(raw) {
  return decodeURIComponent(String(raw || "").replace(/\\+/g, " "));
}

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = JSON.stringify(payload);
    const options = {
      method: "POST",
      hostname: url.hostname,
      path: \`\${url.pathname}\${url.search}\`,
      port: url.port || 443,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: responseBody });
          return;
        }
        reject(new Error(\`Callback failed with status \${res.statusCode}: \${responseBody}\`));
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const detail = event && event.detail ? event.detail : {};
  const bucketName = detail?.bucket?.name || "";
  const objectKey = decodeObjectKey(detail?.object?.key || "");

  if (!bucketName || !objectKey) {
    return { ok: true, skipped: "missing_bucket_or_key" };
  }

  ${input.matcherBody}

  const payload = {
    callback_token: CALLBACK_TOKEN,
    trigger_type: "${input.triggerType}",
    event_id: event.id || "",
    account_id: ACCOUNT_ID || (event.account || ""),
    region: REGION || (event.region || ""),
    role_arn: ROLE_ARN,
    bucket_name: bucketName,
    object_key: objectKey,
    source_type: SOURCE_TYPE,
    schema_type: SCHEMA_TYPE,
    cadence: CADENCE,
  };

  await postJson(FILE_EVENT_CALLBACK_URL, payload);
  return { ok: true, forwarded: true, bucket_name: bucketName, object_key: objectKey };
};
`
}

function CopyButton({
  onCopy,
  copied,
  disabled,
}: {
  onCopy: () => void
  copied: boolean
  disabled?: boolean
}) {
  return (
    <Button type="button" size="sm" variant="outline" className="h-8 rounded-md" disabled={disabled} onClick={onCopy}>
      {copied ? "Copied" : (
        <span className="inline-flex items-center gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          Copy
        </span>
      )}
    </Button>
  )
}

function SetupStepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="grid grid-cols-1 gap-2 md:grid-cols-6" aria-label="Manual setup progress">
      {STEPS.map((step, index) => {
        const active = index === currentStep
        const done = index < currentStep
        return (
          <li
            key={step}
            className={cn(
              "rounded-[10px] border px-3 py-2 text-xs",
              active
                ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-soft)]"
                : done
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-[color:var(--border-light)] bg-white",
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                  active
                    ? "bg-[color:var(--brand-primary)] text-white"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-[color:var(--bg-surface)] text-text-muted",
                )}
              >
                {index + 1}
              </span>
              <p className={cn("font-semibold", active ? "text-brand-primary" : "text-text-secondary")}>{step}</p>
            </div>
            <p className="text-[11px] text-text-muted">{active ? "Active" : done ? "Completed" : "Upcoming"}</p>
          </li>
        )
      })}
    </ol>
  )
}
function ValueCard({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string
  value: string
  copyKey: string
  copiedKey: string | null
  onCopy: (copyKey: string, value: string) => void
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--border-light)] bg-white p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={LABEL_CLASS}>{label}</p>
        <CopyButton onCopy={() => onCopy(copyKey, value)} copied={copiedKey === copyKey} disabled={!value.trim()} />
      </div>
      <p className="break-all rounded-md bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm text-text-primary">
        {value || "-"}
      </p>
    </div>
  )
}

type AwsConsoleLinkProps = {
  label: string
  url: string
  className?: string
}

type PolicyDrawerState = {
  open: boolean
  title: string
  content: string
  description?: string
  bullets?: string[]
  note?: string
  copyActionLabel?: string
  copyAllFromKeyValues?: boolean
  keyValues?: Array<{ key: string; value: string; helper?: string }>
}

type HelpModalState = {
  open: boolean
  title: string
  context: string
}

type InlineGuideStepProps = {
  title: string
  children: ReactNode
  previewTitle: string
  previewContext: string
  onOpenHelp: (title: string, context: string) => void
}

function buildIamConsoleUrl(path: string, region: string) {
  const base = "https://console.aws.amazon.com/iam/home"
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const regionParam = region.trim() ? `?region=${encodeURIComponent(region.trim())}` : ""
  return `${base}${regionParam}#${normalizedPath}`
}

function AwsConsoleLink({ label, url, className }: AwsConsoleLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens AWS Console in a new tab"
      className={cn("inline-flex items-center gap-1 text-sm font-medium text-brand-primary underline-offset-4 hover:underline", className)}
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function InlineActionLink({
  label,
  onClick,
  className,
  disabled,
}: {
  label: string
  onClick: () => void
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium text-brand-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline",
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

function ReadonlyCopyField({
  value,
  copyKey,
  copiedKey,
  onCopy,
  ariaLabel,
}: {
  value: string
  copyKey: string
  copiedKey: string | null
  onCopy: (copyKey: string, value: string) => void
  ariaLabel: string
}) {
  return (
    <div className="inline-flex min-w-[260px] max-w-full items-center gap-1 rounded-md bg-[color:var(--bg-surface)] px-2 py-1">
      <span className="truncate px-1.5 py-1 text-sm text-text-primary">{value || "-"}</span>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-muted hover:bg-[color:var(--brand-soft)] hover:text-text-primary"
        onClick={() => onCopy(copyKey, value)}
        aria-label={ariaLabel}
        title={copiedKey === copyKey ? "Copied" : "Copy"}
      >
        {copiedKey === copyKey ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function InlineGuideStep({
  title,
  children,
  previewTitle,
  previewContext,
  onOpenHelp,
}: InlineGuideStepProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 border-t border-[color:var(--border-light)] py-4 md:grid-cols-[minmax(0,1fr)_190px]">
      <div className="space-y-2">
        <p className="text-[17px] font-semibold text-text-primary">{title}</p>
        <div className="space-y-1 text-[15px] leading-6 text-text-secondary">{children}</div>
      </div>
      <div className="self-start">
        <p className="mb-1 text-xs font-medium text-text-primary">{previewTitle}</p>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-1.5 text-[13px] font-medium text-brand-primary hover:border-[color:var(--brand-primary)] hover:underline"
          onClick={() => onOpenHelp(previewTitle, previewContext)}
        >
          Preview
        </button>
        <p className="mt-1 text-[12px] text-text-muted">See steps in AWS</p>
      </div>
    </div>
  )
}

function HelpModal({
  state,
  onOpenChange,
}: {
  state: HelpModalState
  onOpenChange: (nextOpen: boolean) => void
}) {
  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
        </DialogHeader>
        <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-5 text-sm text-text-secondary">
          Screenshot placeholder: {state.context}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PolicyDrawer({
  state,
  copied,
  copiedKey,
  onOpenChange,
  onCopy,
}: {
  state: PolicyDrawerState
  copied: boolean
  copiedKey: string | null
  onOpenChange: (nextOpen: boolean) => void
  onCopy: (copyKey: string, value: string) => void
}) {
  const copyValue = state.copyAllFromKeyValues
    ? (state.keyValues ?? []).map((row) => `${row.key}=${row.value}`).join("\n")
    : state.content

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-[min(96vw,44rem)] translate-x-0 translate-y-0 rounded-none border-l border-[color:var(--border-light)] p-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-[color:var(--border-light)] px-5 py-4">
            <div className="flex items-center justify-between gap-3 pr-10">
              <DialogTitle>{state.title}</DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md"
                onClick={() => onCopy("policy-drawer-copy", copyValue)}
                disabled={!copyValue.trim()}
              >
                {copied ? "Copied" : (state.copyActionLabel ?? "Copy")}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-5 py-4">
            {state.description ? <p className="mb-2 text-sm text-text-secondary">{state.description}</p> : null}
            {state.bullets?.length ? (
              <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {state.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {state.keyValues?.length ? (
              <div className="mb-3 overflow-x-auto rounded-md border border-[color:var(--border-light)] bg-white">
                <div className="min-w-[620px]">
                  <div className="grid grid-cols-[minmax(0,230px)_minmax(0,1fr)_64px] items-center bg-[color:var(--bg-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                    <p>Key</p>
                    <p>Value</p>
                    <p className="text-right">Copy</p>
                  </div>
                  {state.keyValues.map((row) => {
                    const rowCopyKey = `policy-drawer-kv-${row.key}`
                    const copiedRow = copiedKey === rowCopyKey
                    return (
                      <div
                        key={row.key}
                        className="grid grid-cols-[minmax(0,230px)_minmax(0,1fr)_64px] items-start gap-2 border-t border-[color:var(--border-light)] px-3 py-2.5"
                      >
                        <p className="break-all pr-2 font-mono text-[12px] text-text-primary">{row.key}</p>
                        <div className="space-y-1">
                          <p
                            className="whitespace-pre-wrap break-all font-mono text-[12px] leading-5 text-text-primary"
                            title={row.value}
                          >
                            {row.value}
                          </p>
                          {row.helper ? <p className="text-[11px] text-text-muted">{row.helper}</p> : null}
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-[color:var(--brand-soft)] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => onCopy(rowCopyKey, row.value)}
                            aria-label={`Copy ${row.key} value`}
                            title={copiedRow ? "Copied" : "Copy value"}
                            disabled={!row.value.trim()}
                          >
                            {copiedRow ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
            {state.note ? <p className="mb-3 text-xs text-text-muted">{state.note}</p> : null}
            {state.content.trim() ? (
              <pre className="max-h-full overflow-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs leading-relaxed text-text-primary">
                <code>{state.content}</code>
              </pre>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ValidationBanner({
  state,
  idleText,
  successText,
  errorText,
}: {
  state: ValidationState
  idleText: string
  successText: string
  errorText: string
}) {
  if (state === "loading") {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        Validating...
      </div>
    )
  }

  if (state === "success") {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        {successText}
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <AlertTriangle className="h-4 w-4" />
        {errorText}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-muted">
      {idleText}
    </div>
  )
}

function OptionalSection({
  enabled,
  title,
  description,
  children,
}: {
  enabled: boolean
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <details className="space-y-3 rounded-[10px] border border-[color:var(--border-light)] bg-white p-3" open={enabled}>
      <summary className="cursor-pointer list-none">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </summary>
      <div className="mt-3 border-t border-[color:var(--border-light)] pt-3">
        {enabled ? children : <p className="text-sm text-text-muted">CloudTrail is disabled. This step is skippable.</p>}
      </div>
    </details>
  )
}
function SetupSummary({
  form,
  derived,
  billingValidation,
  exportValidation,
  fileEventValidation,
  cloudTrailValidation,
}: {
  form: ManualSetupForm
  derived: DerivedValues
  billingValidation: ValidationState
  exportValidation: ValidationState
  fileEventValidation: ValidationState
  cloudTrailValidation: ValidationState
}) {
  const groupedSummary: Array<{ title: string; rows: Array<{ label: string; value: string }> }> = [
    {
      title: "Roles",
      rows: [
        { label: "Billing role name", value: derived.billingRoleName },
        { label: "Action role name", value: form.enableActionRole ? derived.actionRoleName : "Disabled" },
      ],
    },
    {
      title: "Buckets",
      rows: [
        { label: "Export bucket name", value: form.exportBucket },
        { label: "CloudTrail bucket name", value: form.enableCloudTrail ? form.cloudTrailBucket : "Disabled" },
      ],
    },
    {
      title: "Prefixes",
      rows: [
        { label: "Export prefix", value: form.exportPrefix },
        { label: "CloudTrail prefix", value: form.enableCloudTrail ? form.cloudTrailPrefix : "Disabled" },
      ],
    },
    {
      title: "Export / Trail",
      rows: [
        { label: "Export name", value: form.exportName || derived.exportName },
        { label: "Export ARN", value: form.exportArn || "-" },
        { label: "Trail name", value: form.enableCloudTrail ? form.trailName : "Disabled" },
      ],
    },
  ]

  const checklist = [
    { label: "Billing role validated", done: billingValidation === "success" },
    { label: "Export configured", done: exportValidation === "success" },
    { label: "File events ready", done: fileEventValidation === "success" },
    { label: "CloudTrail ready", done: form.enableCloudTrail ? cloudTrailValidation === "success" : true },
  ]

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-text-primary">Generated Summary</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groupedSummary.map((group) => (
            <div key={group.title} className="space-y-2 border-t border-[color:var(--border-light)] pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">{group.title}</p>
              {group.rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-text-secondary">{row.label}</span>
                  <span className="break-all text-right text-text-primary">{row.value || "-"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-text-primary">Setup Checklist</h3>
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-md border border-[color:var(--border-light)] px-3 py-2 text-sm">
            <span className="text-text-primary">{item.label}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
              {item.done ? "Ready" : "Pending"}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}

function ManualSetupWizard({ activeRoute }: { activeRoute: string }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [policyDrawer, setPolicyDrawer] = useState<PolicyDrawerState>({
    open: false,
    title: "",
    content: "",
    description: "",
    bullets: [],
    note: "",
    copyActionLabel: "Copy",
    copyAllFromKeyValues: false,
  })
  const [helpModal, setHelpModal] = useState<HelpModalState>({ open: false, title: "", context: "" })

  const [billingValidation, setBillingValidation] = useState<ValidationState>("idle")
  const [exportValidation, setExportValidation] = useState<ValidationState>("idle")
  const [fileEventValidation, setFileEventValidation] = useState<ValidationState>("idle")
  const [cloudTrailValidation, setCloudTrailValidation] = useState<ValidationState>("idle")
  const [isCompletingSetup, setIsCompletingSetup] = useState(false)
  const [completeSetupError, setCompleteSetupError] = useState<string | null>(null)

  const [form, setForm] = useState<ManualSetupForm>(() => {
    const env = import.meta.env as Record<string, unknown>
    const defaultPrincipalArn =
      typeof env.VITE_KCX_AWS_PRINCIPAL_ARN === "string" && env.VITE_KCX_AWS_PRINCIPAL_ARN.trim().length > 0
        ? env.VITE_KCX_AWS_PRINCIPAL_ARN.trim()
        : "arn:aws:iam::275017715736:root"

    const callbackUrl =
      typeof env.VITE_KCX_FILE_EVENT_CALLBACK_URL === "string" && env.VITE_KCX_FILE_EVENT_CALLBACK_URL.trim().length > 0
        ? env.VITE_KCX_FILE_EVENT_CALLBACK_URL.trim()
        : "https://api.kcxhq.com/v1/aws/file-events"

    const connectionName = "prod-aws-account"
    const awsAccountId = ""
    const awsRegion = "us-east-1"
    const normalized = normalizeConnectionName(connectionName)

    return {
      externalId: randomAlphaNumeric(24),
      connectionName,
      kcxPrincipalArn: defaultPrincipalArn,
      fileEventCallbackUrl: callbackUrl,
      callbackToken: randomAlphaNumeric(32),
      awsAccountId,
      awsRegion,
      enableCloudTrail: false,
      enableActionRole: true,
      enableEc2Module: true,
      useTagScopedAccess: false,
      billingRoleArn: "",
      actionRoleArn: "",
      exportBucket: `kcx-billing-export-${awsAccountId}-${awsRegion}-${normalized}`,
      exportPrefix: "kcx/data-exports/cur2",
      exportRegion: awsRegion,
      exportName: "KCX-CUR2-Export",
      exportArn: "",
      fileEventLambdaArn: "",
      eventBridgeRuleName: "kcx-billing-export-object-created",
      cloudTrailBucket: `kcx-cloudtrail-${awsAccountId}-${awsRegion}-${normalized}`,
      cloudTrailPrefix: "kcx/cloudtrail",
      trailName: "KCX-Trail",
      cloudTrailLambdaArn: "",
      cloudTrailRuleName: "kcx-cloudtrail-object-created",
    }
  })

  const derived = useMemo<DerivedValues>(() => {
    const normalized = normalizeConnectionName(form.connectionName)
    return {
      billingRoleName: `kcx-${normalized}-billing-role`,
      actionRoleName: `kcx-${normalized}-action-role`,
      exportBucketName: `kcx-billing-export-${form.awsAccountId}-${form.awsRegion}-${normalized}`,
      cloudTrailBucketName: `kcx-cloudtrail-${form.awsAccountId}-${form.awsRegion}-${normalized}`,
      exportPrefix: "kcx/data-exports/cur2",
      cloudTrailPrefix: "kcx/cloudtrail",
      exportName: "KCX-CUR2-Export",
      cloudTrailName: "KCX-Trail",
    }
  }, [form.awsAccountId, form.awsRegion, form.connectionName])

  const requiredSetupValuesReady = useMemo(() => {
    return (
      form.externalId.trim().length > 0
      && form.connectionName.trim().length > 0
      && form.kcxPrincipalArn.trim().length > 0
      && form.fileEventCallbackUrl.trim().length > 0
      && form.callbackToken.trim().length > 0
      && /^\d{12}$/.test(form.awsAccountId.trim())
      && form.awsRegion.trim().length > 0
    )
  }, [form])
  const generated = useMemo<GeneratedSnippet>(() => {
    const exportPrefix = form.exportPrefix.trim().replace(/^\/+/, "")
    const cloudTrailPrefix = form.cloudTrailPrefix.trim().replace(/^\/+/, "")

    const billingRoleTrustPolicy = pretty({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: form.kcxPrincipalArn.trim() },
          Action: "sts:AssumeRole",
          Condition: { StringEquals: { "sts:ExternalId": form.externalId.trim() } },
        },
      ],
    })

    const billingStatements: Array<Record<string, unknown>> = [
      {
        Sid: "ValidationApis",
        Effect: "Allow",
        Action: [
          "sts:GetCallerIdentity",
          "ec2:DescribeRegions",
          "ec2:DescribeInstances",
          "ec2:DescribeVolumes",
          "ec2:DescribeAddresses",
          "ec2:DescribeSnapshots",
          "elasticloadbalancing:DescribeLoadBalancers",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "ec2:DescribeTags",
          "cloudwatch:ListMetrics",
          "tag:GetResources",
          "compute-optimizer:GetEC2InstanceRecommendations",
          "compute-optimizer:GetEnrollmentStatus",
          "compute-optimizer:UpdateEnrollmentStatus",
          "ce:StartSavingsPlansPurchaseRecommendationGeneration",
          "ce:GetSavingsPlansPurchaseRecommendation",
          "ce:GetSavingsPlanPurchaseRecommendationDetails",
        ],
        Resource: "*",
      },
      {
        Sid: "ExportBucketList",
        Effect: "Allow",
        Action: "s3:ListBucket",
        Resource: `arn:aws:s3:::${form.exportBucket.trim()}`,
        Condition: {
          StringLike: {
            "s3:prefix": [
              `${exportPrefix}`,
              `${exportPrefix}/*`,
              `${exportPrefix}/metadata/*`,
              `${exportPrefix}/data/*`,
            ],
          },
        },
      },
      {
        Sid: "ExportBucketGetLocation",
        Effect: "Allow",
        Action: "s3:GetBucketLocation",
        Resource: `arn:aws:s3:::${form.exportBucket.trim()}`,
      },
      {
        Sid: "ExportBucketReadObjects",
        Effect: "Allow",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${form.exportBucket.trim()}/${exportPrefix}/*`,
      },
    ]

    if (form.enableCloudTrail) {
      billingStatements.push(
        {
          Sid: "CloudTrailBucketReadMeta",
          Effect: "Allow",
          Action: ["s3:ListBucket", "s3:GetBucketLocation"],
          Resource: `arn:aws:s3:::${form.cloudTrailBucket.trim()}`,
          Condition: {
            StringLike: {
              "s3:prefix": [
                `${cloudTrailPrefix}`,
                `${cloudTrailPrefix}/*`,
                `${cloudTrailPrefix}/AWSLogs/*`,
              ],
            },
          },
        },
        {
          Sid: "CloudTrailReadObjects",
          Effect: "Allow",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${form.cloudTrailBucket.trim()}/${cloudTrailPrefix}/*`,
        },
      )
    }

    const billingRolePermissionsPolicy = pretty({ Version: "2012-10-17", Statement: billingStatements })

    const exportSourceArn = `arn:aws:bcm-data-exports:${form.awsRegion.trim()}:${form.awsAccountId.trim()}:export/*`

    const exportBucketPolicy = pretty({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowBcmDataExportsWrite",
          Effect: "Allow",
          Principal: { Service: "bcm-data-exports.amazonaws.com" },
          Action: "s3:PutObject",
          Resource: `arn:aws:s3:::${form.exportBucket.trim()}/*`,
          Condition: { StringEquals: { "aws:SourceAccount": form.awsAccountId.trim(), "aws:SourceArn": exportSourceArn } },
        },
        {
          Sid: "AllowBcmDataExportsReadBucketConfig",
          Effect: "Allow",
          Principal: { Service: "bcm-data-exports.amazonaws.com" },
          Action: ["s3:GetBucketPolicy", "s3:GetBucketLocation"],
          Resource: `arn:aws:s3:::${form.exportBucket.trim()}`,
          Condition: { StringEquals: { "aws:SourceAccount": form.awsAccountId.trim(), "aws:SourceArn": exportSourceArn } },
        },
      ],
    })

    const actionRoleTrustPolicy = pretty({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: form.kcxPrincipalArn.trim() },
          Action: "sts:AssumeRole",
          Condition: { StringEquals: { "sts:ExternalId": form.externalId.trim() } },
        },
      ],
    })

    const actionRoleBasePermissionsPolicy = pretty({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Action: ["sts:GetCallerIdentity", "ec2:DescribeRegions"], Resource: "*" }],
    })

    const ec2ActionStatement: Record<string, unknown> = {
      Effect: "Allow",
      Action: ["ec2:StartInstances", "ec2:StopInstances", "ec2:RebootInstances"],
      Resource: "arn:aws:ec2:*:*:instance/*",
    }
    if (form.useTagScopedAccess) {
      ec2ActionStatement.Condition = { StringEquals: { "aws:ResourceTag/managed-by": "kcx" } }
    }

    const ec2ModulePolicy = pretty({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["ec2:DescribeInstances", "ec2:DescribeInstanceStatus", "ec2:DescribeTags", "ec2:DescribeRegions"],
          Resource: "*",
        },
        ec2ActionStatement,
      ],
    })

    const cloudTrailBucketPolicy = pretty({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "cloudtrail.amazonaws.com" },
          Action: "s3:GetBucketAcl",
          Resource: `arn:aws:s3:::${form.cloudTrailBucket.trim()}`,
        },
        {
          Effect: "Allow",
          Principal: { Service: "cloudtrail.amazonaws.com" },
          Action: "s3:PutObject",
          Resource: `arn:aws:s3:::${form.cloudTrailBucket.trim()}/${cloudTrailPrefix}/AWSLogs/${form.awsAccountId.trim()}/*`,
          Condition: { StringEquals: { "s3:x-amz-acl": "bucket-owner-full-control" } },
        },
      ],
    })

    const billingLambdaFunctionCode = buildNodeLambdaFunctionCode({
      callbackUrl: form.fileEventCallbackUrl.trim(),
      callbackToken: form.callbackToken.trim(),
      prefix: exportPrefix,
      triggerType: "manifest_created",
      sourceType: "aws_data_exports_cur2",
      schemaType: "cur2_custom",
      cadence: "hourly",
      matcherBody: `if (!objectKey.startsWith(PREFIX)) {
    return { ok: true, skipped: "prefix_mismatch" };
  }

  const lowerKey = objectKey.toLowerCase();
  const metadataPrefix = \`\${PREFIX.replace(/\\/+$/, "")}/metadata/\`;
  if (!lowerKey.includes("/metadata/") || !lowerKey.endsWith("manifest.json") || !objectKey.startsWith(metadataPrefix)) {
    return { ok: true, skipped: "not_manifest_file" };
  }`,
    })

    const billingLambdaEnvValues = pretty({
      FILE_EVENT_CALLBACK_URL: form.fileEventCallbackUrl.trim(),
      CALLBACK_TOKEN: form.callbackToken.trim(),
      ROLE_ARN: form.billingRoleArn.trim(),
      EXPORT_PREFIX: exportPrefix,
      SOURCE_TYPE: "aws_data_exports_cur2",
      SCHEMA_TYPE: "cur2_custom",
      CADENCE: "hourly",
    })

    const cloudTrailLambdaFunctionCode = buildNodeLambdaFunctionCode({
      callbackUrl: form.fileEventCallbackUrl.trim(),
      callbackToken: form.callbackToken.trim(),
      prefix: cloudTrailPrefix,
      triggerType: "cloudtrail_object_created",
      sourceType: "aws_cloudtrail",
      schemaType: "cloudtrail_json",
      cadence: "event_driven",
      matcherBody: `if (!objectKey.startsWith(PREFIX)) {
    return { ok: true, skipped: "prefix_mismatch" };
  }

  const lowerKey = objectKey.toLowerCase();
  const isCloudTrailFile = lowerKey.includes("/awslogs/") && (lowerKey.endsWith(".json") || lowerKey.endsWith(".json.gz"));
  if (!isCloudTrailFile) {
    return { ok: true, skipped: "not_cloudtrail_object" };
  }`,
    })

    const cloudTrailLambdaEnvValues = pretty({
      FILE_EVENT_CALLBACK_URL: form.fileEventCallbackUrl.trim(),
      CALLBACK_TOKEN: form.callbackToken.trim(),
      ROLE_ARN: form.billingRoleArn.trim(),
      CLOUDTRAIL_PREFIX: cloudTrailPrefix,
      SOURCE_TYPE: "aws_cloudtrail",
      SCHEMA_TYPE: "cloudtrail_json",
      CADENCE: "event_driven",
    })

    const billingEventBridgeParams = pretty({
      source: "aws.s3",
      "detail-type": "Object Created",
      bucketName: form.exportBucket.trim(),
      objectKeyPrefix: exportPrefix,
      ruleName: form.eventBridgeRuleName.trim(),
      targetLambdaArn: form.fileEventLambdaArn.trim(),
    })

    const cloudTrailEventBridgeParams = pretty({
      source: "aws.s3",
      "detail-type": "Object Created",
      bucketName: form.cloudTrailBucket.trim(),
      objectKeyPrefix: cloudTrailPrefix,
      ruleName: form.cloudTrailRuleName.trim(),
      targetLambdaArn: form.cloudTrailLambdaArn.trim(),
    })

    return {
      billingRoleTrustPolicy,
      billingRolePermissionsPolicy,
      exportBucketPolicy,
      actionRoleTrustPolicy,
      actionRoleBasePermissionsPolicy,
      ec2ModulePolicy,
      cloudTrailBucketPolicy,
      billingLambdaFunctionCode,
      billingLambdaEnvValues,
      cloudTrailLambdaFunctionCode,
      cloudTrailLambdaEnvValues,
      billingEventBridgeParams,
      cloudTrailEventBridgeParams,
    }
  }, [form])

  function setField<K extends keyof ManualSetupForm>(field: K, value: ManualSetupForm[K]) {
    setForm((previous) => {
      const next = { ...previous, [field]: value }
      if (field === "enableEc2Module") {
        next.enableActionRole = Boolean(value)
      }
      if (field === "connectionName" || field === "awsAccountId" || field === "awsRegion") {
        const connectionName = field === "connectionName" ? String(value) : next.connectionName
        const accountId = field === "awsAccountId" ? String(value) : next.awsAccountId
        const region = field === "awsRegion" ? String(value) : next.awsRegion
        const normalized = normalizeConnectionName(connectionName)
        next.exportBucket = `kcx-billing-export-${accountId}-${region}-${normalized}`
        next.cloudTrailBucket = `kcx-cloudtrail-${accountId}-${region}-${normalized}`
        if (field === "awsRegion") next.exportRegion = region
      }
      return next
    })
  }

  async function copyToClipboard(copyKey: string, value: string) {
    if (!value.trim()) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(copyKey)
    window.setTimeout(() => setCopiedKey((current) => (current === copyKey ? null : current)), 1200)
  }

  function openPolicyDrawer(
    title: string,
    content: string,
    details?: {
      description?: string
      bullets?: string[]
      note?: string
      copyActionLabel?: string
      copyAllFromKeyValues?: boolean
      keyValues?: Array<{ key: string; value: string; helper?: string }>
    },
  ) {
    setPolicyDrawer({
      open: true,
      title,
      content,
      description: details?.description ?? "",
      bullets: details?.bullets ?? [],
      note: details?.note ?? "",
      copyActionLabel: details?.copyActionLabel ?? "Copy",
      copyAllFromKeyValues: details?.copyAllFromKeyValues ?? false,
      keyValues: details?.keyValues ?? [],
    })
  }

  function openHelpModal(title: string, context: string) {
    setHelpModal({ open: true, title, context })
  }

  function simulateValidation(setter: Dispatch<SetStateAction<ValidationState>>, success: boolean) {
    setter("loading")
    // TODO: Replace mock validation with backend validation endpoints when available.
    window.setTimeout(() => setter(success ? "success" : "error"), 900)
  }
  const canProceedFromStep = useMemo(() => {
    if (currentStep === 0) return requiredSetupValuesReady
    if (currentStep === 1) {
      return (
        form.billingRoleArn.trim().length > 0
        && billingValidation === "success"
        && (!form.enableActionRole || form.actionRoleArn.trim().length > 0)
      )
    }
    if (currentStep === 2) {
      return (
        form.exportBucket.trim().length > 0
        && form.exportPrefix.trim().length > 0
        && form.exportRegion.trim().length > 0
        && (form.exportName.trim().length > 0 || form.exportArn.trim().length > 0)
        && exportValidation === "success"
      )
    }
    if (currentStep === 3) {
      return (
        form.fileEventLambdaArn.trim().length > 0
        && form.eventBridgeRuleName.trim().length > 0
        && fileEventValidation === "success"
      )
    }
    if (currentStep === 4) {
      if (!form.enableCloudTrail) return true
      return (
        form.cloudTrailBucket.trim().length > 0
        && form.cloudTrailPrefix.trim().length > 0
        && form.trailName.trim().length > 0
        && form.cloudTrailLambdaArn.trim().length > 0
        && form.cloudTrailRuleName.trim().length > 0
        && cloudTrailValidation === "success"
      )
    }
    if (currentStep === 5) {
      return (
        billingValidation === "success"
        && exportValidation === "success"
        && fileEventValidation === "success"
        && (!form.enableActionRole || form.actionRoleArn.trim().length > 0)
        && (!form.enableCloudTrail || cloudTrailValidation === "success")
      )
    }
    return false
  }, [
    billingValidation,
    cloudTrailValidation,
    currentStep,
    exportValidation,
    fileEventValidation,
    form,
    requiredSetupValuesReady,
  ])

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  function goNext() {
    if (!canProceedFromStep) return
    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1))
  }

  async function finishSetup() {
    if (!canProceedFromStep) return
    setIsCompletingSetup(true)
    setCompleteSetupError(null)

    const setupPayloadJson: Record<string, unknown> = {
      setupValues: {
        externalId: form.externalId.trim(),
        connectionName: form.connectionName.trim(),
        kcxPrincipalArn: form.kcxPrincipalArn.trim(),
        fileEventCallbackUrl: form.fileEventCallbackUrl.trim(),
        callbackToken: form.callbackToken.trim(),
        awsAccountId: form.awsAccountId.trim(),
        awsRegion: form.awsRegion.trim(),
        enableCloudTrail: form.enableCloudTrail,
        enableActionRole: form.enableActionRole,
        enableEc2Module: form.enableEc2Module,
        useTagScopedAccess: form.useTagScopedAccess,
      },
      generated: {
        billingRoleName: derived.billingRoleName,
        actionRoleName: form.enableActionRole ? derived.actionRoleName : null,
        actionRoleArn: form.enableActionRole ? form.actionRoleArn.trim() : null,
        exportBucketName: form.exportBucket.trim(),
        exportPrefix: form.exportPrefix.trim(),
        exportName: form.exportName.trim(),
        exportArn: form.exportArn.trim(),
        cloudtrailBucketName: form.enableCloudTrail ? form.cloudTrailBucket.trim() : null,
        cloudtrailPrefix: form.enableCloudTrail ? form.cloudTrailPrefix.trim() : null,
      },
      validations: {
        billingRole: billingValidation,
        billingExport: exportValidation,
        fileEventAutomation: fileEventValidation,
        cloudTrail: form.enableCloudTrail ? cloudTrailValidation : "disabled",
      },
    }

    try {
      await completeAwsManualSetup({
        connectionName: form.connectionName.trim(),
        awsAccountId: form.awsAccountId.trim(),
        awsRegion: form.awsRegion.trim(),
        externalId: form.externalId.trim(),
        kcxPrincipalArn: form.kcxPrincipalArn.trim(),
        fileEventCallbackUrl: form.fileEventCallbackUrl.trim(),
        callbackToken: form.callbackToken.trim(),
        billingRoleName: derived.billingRoleName,
        billingRoleArn: form.billingRoleArn.trim(),
        exportBucketName: form.exportBucket.trim(),
        exportPrefix: form.exportPrefix.trim(),
        ...(form.exportName.trim() ? { exportName: form.exportName.trim() } : {}),
        ...(form.exportArn.trim() ? { exportArn: form.exportArn.trim() } : {}),
        enableActionRole: form.enableActionRole,
        ...(form.enableActionRole ? { actionRoleName: derived.actionRoleName, actionRoleArn: form.actionRoleArn.trim() } : {}),
        enableEc2Module: form.enableEc2Module,
        useTagScopedAccess: form.useTagScopedAccess,
        billingFileEventLambdaArn: form.fileEventLambdaArn.trim(),
        billingEventbridgeRuleName: form.eventBridgeRuleName.trim(),
        billingFileEventStatus: fileEventValidation === "success" ? "validated" : "configured",
        enableCloudTrail: form.enableCloudTrail,
        ...(form.enableCloudTrail
          ? {
              cloudtrailBucketName: form.cloudTrailBucket.trim(),
              cloudtrailPrefix: form.cloudTrailPrefix.trim(),
              cloudtrailTrailName: form.trailName.trim(),
              cloudtrailLambdaArn: form.cloudTrailLambdaArn.trim(),
              cloudtrailEventbridgeRuleName: form.cloudTrailRuleName.trim(),
              cloudtrailStatus: cloudTrailValidation === "success" ? "validated" : "configured",
            }
          : {}),
        setupStep: 6,
        setupPayloadJson,
      })
      goToSuccessPage()
    } catch (error) {
      if (error instanceof ApiError) {
        setCompleteSetupError(error.message || "Failed to complete manual setup.")
      } else {
        setCompleteSetupError(error instanceof Error ? error.message : "Failed to complete manual setup.")
      }
    } finally {
      setIsCompletingSetup(false)
    }
  }

  function goToSuccessPage() {
    const successRoute = activeRoute.startsWith("/client/billing/connections/")
      ? "/client/billing/connections/aws/manual/success"
      : "/client/billing/connect-cloud/aws/manual/success"
    navigateTo(successRoute)
  }

  const createRoleUrl = useMemo(() => buildIamConsoleUrl("/roles/create", form.awsRegion), [form.awsRegion])
  const createBucketUrl = "https://console.aws.amazon.com/s3/buckets"
  const dataExportsUrl = "https://console.aws.amazon.com/costmanagement/home?#/data-exports"
  const createLambdaUrl = "https://console.aws.amazon.com/lambda/home#/functions/create"
  const eventBridgeRulesUrl = "https://console.aws.amazon.com/events/home#/rules"
  const cloudTrailUrl = "https://console.aws.amazon.com/cloudtrail/home"
  const billingFileEventFunctionName = "kcx-billing-file-event-handler"
  const billingFileEventRuntime = "Node.js 18.x"
  const cloudTrailFunctionName = "kcx-cloudtrail-event-handler"
  const cloudTrailFunctionRuntime = "Node.js 18.x"
  const billingFileEventLambdaCode = `const https = require('https');
const { URL } = require('url');

function postJson(urlString, payload) {
  const parsed = new URL(urlString);
  const body = JSON.stringify(payload);

  const options = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.pathname + (parsed.search || ''),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(\`File event callback failed: \${res.statusCode} \${data}\`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const callbackUrl = process.env.FILE_EVENT_CALLBACK_URL;
  const callbackToken = process.env.CALLBACK_TOKEN;
  const roleArn = process.env.ROLE_ARN;
  const exportPrefix = process.env.EXPORT_PREFIX || '';
  const sourceType = process.env.SOURCE_TYPE;
  const schemaType = process.env.SCHEMA_TYPE;
  const cadence = process.env.CADENCE;

  if (!callbackUrl || !callbackToken || !roleArn) {
    throw new Error('Missing required Lambda environment variables');
  }

  const bucket = event?.detail?.bucket?.name;
  const rawKey = event?.detail?.object?.key;
  const eventId = event?.id || null;

  if (!bucket || !rawKey) {
    throw new Error('Missing bucket name or object key in EventBridge event');
  }

  const objectKey = decodeURIComponent(String(rawKey).replace(/\\+/g, ' '));

  if (exportPrefix && !objectKey.startsWith(exportPrefix)) {
    return;
  }

  const isManifest =
    objectKey.includes('/metadata/') &&
    objectKey.endsWith('Manifest.json');

  if (!isManifest) {
    return;
  }

  await postJson(callbackUrl, {
    callback_token: callbackToken,
    trigger_type: 'manifest_created',
    event_id: eventId,
    account_id: event.account,
    region: event.region,
    role_arn: roleArn,
    bucket_name: bucket,
    object_key: objectKey,
    source_type: sourceType,
    schema_type: schemaType,
    cadence: cadence
  });
};`
  const billingExportEventPattern = pretty({
    source: ["aws.s3"],
    "detail-type": ["Object Created"],
    detail: {
      bucket: { name: [form.exportBucket.trim()] },
      object: { key: [{ prefix: form.exportPrefix.trim() }] },
    },
  })
  const cloudTrailEventPattern = pretty({
    source: ["aws.s3"],
    "detail-type": ["Object Created"],
    detail: {
      bucket: { name: [form.cloudTrailBucket.trim()] },
      object: { key: [{ prefix: form.cloudTrailPrefix.trim() }] },
    },
  })
  const billingFileEventEnvironmentValues = [
    {
      key: "FILE_EVENT_CALLBACK_URL",
      value: form.fileEventCallbackUrl.trim(),
      helper: "KCX endpoint that receives file event notifications.",
    },
    {
      key: "CALLBACK_TOKEN",
      value: form.callbackToken.trim(),
      helper: "Setup-specific token used to authenticate the callback.",
    },
    {
      key: "ROLE_ARN",
      value: form.billingRoleArn.trim() || "Paste and validate Billing Role ARN in Step 2 first.",
      helper: "Billing role ARN sent back with each file event.",
    },
    {
      key: "EXPORT_PREFIX",
      value: form.exportPrefix.trim() || "kcx/data-exports/cur2",
      helper: "Only files under this prefix are considered.",
    },
    {
      key: "SOURCE_TYPE",
      value: "aws_data_exports_cur2",
      helper: "Identifies the export source.",
    },
    {
      key: "SCHEMA_TYPE",
      value: "cur2_custom",
      helper: "Identifies the KCX schema format.",
    },
    {
      key: "CADENCE",
      value: "hourly",
      helper: "Identifies delivery cadence.",
    },
  ]
  const cloudTrailEnvironmentValues = [
    {
      key: "FILE_EVENT_CALLBACK_URL",
      value: form.fileEventCallbackUrl.trim(),
      helper: "KCX endpoint that receives CloudTrail file event notifications.",
    },
    {
      key: "CALLBACK_TOKEN",
      value: form.callbackToken.trim(),
      helper: "Setup-specific token used to authenticate the callback.",
    },
    {
      key: "ROLE_ARN",
      value: form.billingRoleArn.trim() || "Paste and validate Billing Role ARN in Step 2 first.",
      helper: "Billing role ARN sent with each CloudTrail file event.",
    },
    {
      key: "CLOUDTRAIL_PREFIX",
      value: form.cloudTrailPrefix.trim() || "kcx/cloudtrail",
      helper: "Only CloudTrail files under this prefix are considered.",
    },
    {
      key: "SOURCE_TYPE",
      value: "aws_cloudtrail",
      helper: "Identifies the CloudTrail source.",
    },
    {
      key: "SCHEMA_TYPE",
      value: "cloudtrail_json",
      helper: "Identifies the KCX schema format.",
    },
    {
      key: "CADENCE",
      value: "event_driven",
      helper: "Indicates event-driven ingestion cadence.",
    },
  ]
  const billingExportQuery = `SELECT
  bill_billing_period_start_date AS billing_period_start_date,
  bill_billing_period_end_date AS billing_period_end_date,
  bill_payer_account_id AS billing_account_id,
  bill_payer_account_name AS billing_account_name,
  line_item_usage_account_id AS sub_account_id,
  line_item_usage_account_name AS sub_account_name,
  line_item_product_code AS service_name,
  product_region_code AS region_id,
  product_location AS region_name,
  line_item_availability_zone AS availability_zone,
  pricing_currency AS billing_currency,
  line_item_usage_type AS usage_type,
  line_item_operation AS operation,
  line_item_line_item_type AS line_item_type,
  line_item_resource_id AS resource_id,
  line_item_unblended_cost AS billed_cost,
  line_item_net_unblended_cost AS effective_cost,
  pricing_public_on_demand_cost AS public_on_demand_cost,
  line_item_usage_amount AS consumed_quantity,
  line_item_usage_start_date AS usage_start_time,
  line_item_usage_end_date AS usage_end_time,
  pricing_term AS pricing_term,
  pricing_purchase_option AS purchase_option,
  pricing_unit AS pricing_unit,
  product_sku AS sku_id,
  pricing_rate_id AS sku_price_id,
  pricing_rate_code AS pricing_rate_code,
  tags AS tags_json,
  discount_total_discount AS discount_amount,
  line_item_tax_type AS tax_type,
  reservation_reservation_a_r_n AS reservation_arn,
  savings_plan_savings_plan_a_r_n AS savings_plan_arn,
  savings_plan_offering_type AS savings_plan_type,
  capacity_reservation_capacity_reservation_arn AS capacity_reservation_arn,
  capacity_reservation_capacity_reservation_status AS capacity_reservation_status,
  capacity_reservation_capacity_reservation_type AS capacity_reservation_type
FROM COST_AND_USAGE_REPORT`
  const billingRoleDetailsUrl = useMemo(
    () => buildIamConsoleUrl(`/roles/details/${encodeURIComponent(derived.billingRoleName)}`, form.awsRegion),
    [derived.billingRoleName, form.awsRegion],
  )
  const actionRoleDetailsUrl = useMemo(
    () => buildIamConsoleUrl(`/roles/details/${encodeURIComponent(derived.actionRoleName)}`, form.awsRegion),
    [derived.actionRoleName, form.awsRegion],
  )

  return (
    <div className="space-y-4">
      <SetupStepper currentStep={currentStep} />

      {completed ? (
        <Card className="rounded-[10px] border-emerald-200 bg-emerald-50 shadow-none">
          <CardContent className="space-y-3 p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-900">Manual setup completed</h3>
              <p className="text-sm text-emerald-800">All required setup checks are complete and configuration is ready.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="h-9 rounded-md" onClick={goToSuccessPage}>Go to Success Page</Button>
              <Button className="h-9 rounded-md" variant="outline" onClick={() => setCompleted(false)}>Review Setup</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 0 ? (
        <div className="space-y-4">
          <section className="space-y-3 rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
            <p className={SECTION_TITLE_CLASS}>Connection Details</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Connection Name</span>
                <input className={CONTROL_CLASS} value={form.connectionName} onChange={(event) => setField("connectionName", event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>AWS Account ID</span>
                <input
                  className={cn(CONTROL_CLASS, form.awsAccountId.trim() && !/^\d{12}$/.test(form.awsAccountId.trim()) ? "border-rose-300" : "")}
                  value={form.awsAccountId}
                  onChange={(event) => setField("awsAccountId", event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456789012"
                />
                {form.awsAccountId.trim() && !/^\d{12}$/.test(form.awsAccountId.trim()) ? (
                  <p className="text-xs text-rose-600">AWS Account ID must be 12 digits.</p>
                ) : null}
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>AWS Region</span>
                <input className={CONTROL_CLASS} value={form.awsRegion} onChange={(event) => setField("awsRegion", event.target.value)} />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
            <p className={SECTION_TITLE_CLASS}>Options</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableCloudTrail} onChange={(event) => setField("enableCloudTrail", event.target.checked)} />
                Enable CloudTrail
              </label>
              <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableEc2Module} onChange={(event) => setField("enableEc2Module", event.target.checked)} />
                Enable EC2 Module
              </label>
            </div>
          </section>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="space-y-6">
          <section className="rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
            <p className={SECTION_TITLE_CLASS}>Roles</p>
            <p className="text-sm text-text-secondary">Use these generated values to create the required IAM roles in AWS.</p>
          </section>

          <div className="space-y-6">
            <section className="space-y-1 rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
              <h3 className="text-[22px] font-semibold text-text-primary">Billing Role</h3>

              <InlineGuideStep title="Step 1: Create IAM role" previewTitle="Create role in IAM" previewContext="Create role in IAM" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Go to <strong>IAM → Roles</strong>. <AwsConsoleLink label="Create role in AWS" url={createRoleUrl} className="ml-1" /></li>
                  <li>Click <strong>Create role</strong>.</li>
                  <li>Select <strong>Another AWS account</strong>.</li>
                  <li>
                    Enter this <strong>Account ID</strong>:{" "}
                    <span className="inline-flex align-middle">
                      <ReadonlyCopyField value={form.awsAccountId} copyKey="billing-account-id" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy AWS account ID" />
                    </span>
                  </li>
                  <li>
                    Enable <strong>&quot;Require external ID&quot;</strong> and enter:{" "}
                    <span className="inline-flex align-middle">
                      <ReadonlyCopyField value={form.externalId} copyKey="billing-external-id" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy external ID" />
                    </span>
                  </li>
                  <li>Click <strong>Next -&gt; Next</strong>.</li>
                  <li>
                    Set role name:{" "}
                    <span className="inline-flex align-middle">
                      <ReadonlyCopyField value={derived.billingRoleName} copyKey="billing-role-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy billing role name" />
                    </span>
                  </li>
                  <li>Click <strong>Create role</strong>.</li>
                </ol>
              </InlineGuideStep>

              <InlineGuideStep title="Step 2: Update trust policy" previewTitle="Edit trust policy" previewContext="Edit trust policy" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open the created role.</li>
                  <li>Go to <strong>Trust relationships</strong>.</li>
                  <li>Click <strong>Edit trust policy</strong>.</li>
                  <li>Replace the JSON with this policy:
                    <div><InlineActionLink label="View Billing Role Trust Policy" onClick={() => openPolicyDrawer("Billing Role Trust Policy", generated.billingRoleTrustPolicy)} disabled={!requiredSetupValuesReady} /></div>
                  </li>
                  <li>Click <strong>Update policy</strong>.</li>
                </ol>
              </InlineGuideStep>

              <InlineGuideStep title="Step 3: Add inline permissions policy" previewTitle="Create inline policy" previewContext="Create inline policy" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Go to the <strong>Permissions</strong> tab.</li>
                  <li>Click <strong>Add permissions -&gt; Create inline policy</strong>.</li>
                  <li>Select the <strong>JSON tab</strong>.</li>
                  <li>Replace the JSON with this policy:
                    <div><InlineActionLink label="View Billing Data Access Policy" onClick={() => openPolicyDrawer("Billing Data Access Policy", generated.billingRolePermissionsPolicy)} disabled={!requiredSetupValuesReady} /></div>
                  </li>
                  <li>Click <strong>Review policy</strong>.</li>
                  <li>Enter a policy name.</li>
                  <li>Click <strong>Create policy</strong>.</li>
                </ol>
              </InlineGuideStep>

              <InlineGuideStep title="Step 4: Paste role ARN" previewTitle="Copy role ARN" previewContext="Copy role ARN" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Go to the role summary page.</li>
                  <li>Copy the <strong>Role ARN</strong>.</li>
                  <li>Paste it below.</li>
                  <li>Click <strong>Validate Billing Role</strong>.</li>
                </ol>
                <div className="mt-2">
                  {(form.billingRoleArn.trim() || billingValidation === "success") ? <AwsConsoleLink label="Open this role in AWS" url={billingRoleDetailsUrl} /> : null}
                </div>
                <label className="mt-2 block space-y-1">
                  <span className={LABEL_CLASS}>Billing Role ARN</span>
                  <input
                    className={CONTROL_CLASS}
                    value={form.billingRoleArn}
                    onChange={(event) => {
                      setField("billingRoleArn", event.target.value)
                      setBillingValidation("idle")
                    }}
                    placeholder={`arn:aws:iam::${form.awsAccountId || "123456789012"}:role/${derived.billingRoleName}`}
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setBillingValidation, form.billingRoleArn.includes(derived.billingRoleName))} disabled={!form.billingRoleArn.trim() || billingValidation === "loading"}>Validate Billing Role</Button>
                  <ValidationBanner state={billingValidation} idleText="Validation pending." successText="Billing role validated." errorText="Validation failed. Verify trust policy and ARN." />
                </div>
              </InlineGuideStep>
            </section>

            {form.enableActionRole ? (
              <section className="space-y-1 rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
                <h3 className="text-[22px] font-semibold text-text-primary">Action Role</h3>

                <InlineGuideStep title="Step 1: Create IAM role" previewTitle="Create role in IAM" previewContext="Create role in IAM" onOpenHelp={openHelpModal}>
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>Go to <strong>IAM → Roles</strong>. <AwsConsoleLink label="Create role in AWS" url={createRoleUrl} className="ml-1" /></li>
                    <li>Click <strong>Create role</strong>.</li>
                    <li>Select <strong>Another AWS account</strong>.</li>
                    <li>
                      Enter this <strong>Account ID</strong>:{" "}
                      <span className="inline-flex align-middle">
                        <ReadonlyCopyField value={form.awsAccountId} copyKey="action-account-id" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy AWS account ID" />
                      </span>
                    </li>
                    <li>
                      Enable <strong>&quot;Require external ID&quot;</strong> and enter:{" "}
                      <span className="inline-flex align-middle">
                        <ReadonlyCopyField value={form.externalId} copyKey="action-external-id" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy external ID" />
                      </span>
                    </li>
                    <li>Click <strong>Next -&gt; Next</strong>.</li>
                    <li>
                      Set role name:{" "}
                      <span className="inline-flex align-middle">
                        <ReadonlyCopyField value={derived.actionRoleName} copyKey="action-role-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy action role name" />
                      </span>
                    </li>
                    <li>Click <strong>Create role</strong>.</li>
                  </ol>
                </InlineGuideStep>

                <InlineGuideStep title="Step 2: Update trust policy" previewTitle="Edit trust policy" previewContext="Edit trust policy" onOpenHelp={openHelpModal}>
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>Open the created role.</li>
                    <li>Go to <strong>Trust relationships</strong>.</li>
                    <li>Click <strong>Edit trust policy</strong>.</li>
                    <li>Replace the JSON with this policy:
                      <div><InlineActionLink label="View Action Role Trust Policy" onClick={() => openPolicyDrawer("Action Role Trust Policy", generated.actionRoleTrustPolicy)} disabled={!requiredSetupValuesReady} /></div>
                    </li>
                    <li>Click <strong>Update policy</strong>.</li>
                  </ol>
                </InlineGuideStep>

                <InlineGuideStep title="Step 3: Add inline permissions policy" previewTitle="Create inline policy" previewContext="Create inline policy" onOpenHelp={openHelpModal}>
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>Go to the <strong>Permissions</strong> tab.</li>
                    <li>Click <strong>Add permissions -&gt; Create inline policy</strong>.</li>
                    <li>Select the <strong>JSON tab</strong>.</li>
                    <li>Add this policy:
                      <div><InlineActionLink label="View Core Permissions Policy" onClick={() => openPolicyDrawer("Core Permissions Policy", generated.actionRoleBasePermissionsPolicy)} disabled={!requiredSetupValuesReady} /></div>
                    </li>
                    <li>Click <strong>Review policy</strong>, add a name, then click <strong>Create policy</strong>.</li>
                    {form.enableEc2Module ? <li>If EC2 module is enabled, create another inline policy using:
                      <div><InlineActionLink label="View EC2 Read Access Policy" onClick={() => openPolicyDrawer("EC2 Read Access Policy", generated.ec2ModulePolicy)} disabled={!requiredSetupValuesReady} /></div>
                    </li> : null}
                  </ol>
                </InlineGuideStep>

                <InlineGuideStep title="Step 4: Paste role ARN" previewTitle="Copy role ARN" previewContext="Copy role ARN" onOpenHelp={openHelpModal}>
                  <ol className="list-decimal space-y-2 pl-4">
                    <li>Copy the <strong>Role ARN</strong> from AWS.</li>
                    <li>Paste it below.</li>
                  </ol>
                  <div className="mt-2">{form.actionRoleArn.trim() ? <AwsConsoleLink label="Open this role in AWS" url={actionRoleDetailsUrl} /> : null}</div>
                  <label className="mt-2 block space-y-1">
                    <span className={LABEL_CLASS}>Action Role ARN</span>
                    <input
                      className={CONTROL_CLASS}
                      value={form.actionRoleArn}
                      onChange={(event) => setField("actionRoleArn", event.target.value)}
                      placeholder={`arn:aws:iam::${form.awsAccountId || "123456789012"}:role/${derived.actionRoleName}`}
                    />
                  </label>
                </InlineGuideStep>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="space-y-6">
          <section className="rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
            <p className={SECTION_TITLE_CLASS}>Billing Export</p>
            <p className="text-sm text-text-secondary">Follow these steps to configure AWS Billing Data Export for KCX ingestion.</p>
          </section>

          <section className="space-y-1 rounded-[10px] border border-[color:var(--border-light)] bg-white p-4">
            <h3 className="text-[22px] font-semibold text-text-primary">Billing Export</h3>

            <InlineGuideStep title="Step 1: Create S3 bucket" previewTitle="Create bucket in S3" previewContext="Create bucket in S3" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open AWS S3. <AwsConsoleLink label="Create bucket in AWS" url={createBucketUrl} className="ml-1" /></li>
                <li>Click <strong>Create bucket</strong>.</li>
                <li>
                  Enter bucket name:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField value={form.exportBucket} copyKey="export-bucket-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy export bucket name" />
                  </span>
                </li>
                <li>
                  Select region:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField value={form.exportRegion} copyKey="export-region" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy export region" />
                  </span>
                </li>
                <li>Keep default settings.</li>
                <li>Click <strong>Create bucket</strong>.</li>
              </ol>
            </InlineGuideStep>

            <InlineGuideStep title="Step 2: Add bucket policy" previewTitle="Edit bucket policy" previewContext="Edit bucket policy" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open the created bucket.</li>
                <li>Go to <strong>Permissions</strong> tab.</li>
                <li>Scroll to <strong>Bucket policy</strong>.</li>
                <li>Click <strong>Edit</strong>.</li>
                <li>Replace the policy with:
                  <div>
                    <InlineActionLink
                      label="View Export Bucket Policy"
                      onClick={() =>
                        openPolicyDrawer("Export Bucket Policy", generated.exportBucketPolicy, {
                          description: "This policy allows AWS Billing Data Exports to write data into your S3 bucket securely.",
                          bullets: [
                            "Allows bcm-data-exports.amazonaws.com to write objects",
                            "Restricts access using SourceAccount and SourceArn",
                            "Grants only required S3 permissions (PutObject)",
                          ],
                        })
                      }
                      disabled={!requiredSetupValuesReady || !form.exportBucket.trim()}
                    />
                  </div>
                </li>
                <li>Click <strong>Save changes</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">This policy allows AWS Billing Data Exports to write data into your S3 bucket securely.</p>
            </InlineGuideStep>

            <InlineGuideStep title="Step 3: Create billing export" previewTitle="Create data export" previewContext="Create data export" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open AWS Billing -&gt; Data Exports. <AwsConsoleLink label="Open Data Exports" url={dataExportsUrl} className="ml-1" /></li>
                <li>Click <strong>Create export</strong>.</li>
                <li>
                  Enter export name:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField value={form.exportName} copyKey="export-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy export name" />
                  </span>
                </li>
                <li>Select <strong>Export type: Cost and usage report</strong> and <strong>Format: Parquet</strong>.</li>
                <li>Configure data: <strong>Time granularity: Hourly</strong>, <strong>Include resource IDs: Enabled</strong>.</li>
                <li>
                  In S3 destination choose bucket:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField value={form.exportBucket} copyKey="export-bucket-dest" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy export bucket destination" />
                  </span>
                  {" "}and prefix:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField value={form.exportPrefix} copyKey="export-prefix" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy export prefix" />
                  </span>
                </li>
                <li>Use default KCX query:
                  <div>
                    <InlineActionLink
                      label="View Billing Export Query"
                      onClick={() =>
                        openPolicyDrawer("Billing Export Query", billingExportQuery, {
                          description: "This query exports:",
                          bullets: [
                            "billing period and usage timestamps",
                            "resource IDs and service details",
                            "cost, pricing, and usage metrics",
                            "savings plans and reservation data",
                            "resource tags for attribution",
                          ],
                          note: "This query is pre-configured for KCX ingestion. No changes are required.",
                        })
                      }
                    />
                  </div>
                </li>
                <li>Click <strong>Create export</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">This query selects billing, usage, pricing, and resource-level data required for KCX analytics.</p>
            </InlineGuideStep>

            <InlineGuideStep title="Step 4: Wait for export" previewTitle="Check export status" previewContext="Check export status in AWS" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Wait 1-2 minutes.</li>
                <li>Refresh the page.</li>
                <li>Ensure export status is <strong>Active</strong>.</li>
              </ol>
            </InlineGuideStep>

            <InlineGuideStep title="Step 5: Paste Export ARN" previewTitle="Copy export ARN" previewContext="Copy export ARN" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open the created export.</li>
                <li>Copy the <strong>Export ARN</strong>.</li>
                <li>Paste it below.</li>
                <li>Click <strong>Validate Export</strong>.</li>
              </ol>
              <label className="mt-2 block space-y-1">
                <span className={LABEL_CLASS}>Export ARN</span>
                <input className={CONTROL_CLASS} value={form.exportArn} onChange={(event) => setField("exportArn", event.target.value)} />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setExportValidation, Boolean((form.exportName.trim() || form.exportArn.trim()) && form.exportBucket.trim()))} disabled={exportValidation === "loading"}>Validate Export</Button>
                <ValidationBanner state={exportValidation} idleText="Export validation pending." successText="Export configuration validated." errorText="Validation failed. Review bucket policy and export setup." />
              </div>
            </InlineGuideStep>
          </section>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-[color:var(--brand-primary)] bg-[color:var(--brand-soft)] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-brand-primary" />
              <p className="text-sm font-medium text-text-primary">
                File Event Automation is required for automatic ingestion. This flow routes S3 export files to EventBridge, then Lambda, then KCX callback.
              </p>
            </div>
          </div>

          <section className="space-y-0 rounded-[10px] border border-[color:var(--border-light)] bg-white px-4 py-3">
            <InlineGuideStep title="Step 1: Create Lambda function" previewTitle="Create Lambda function" previewContext="Create Lambda function in AWS Lambda" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open AWS Lambda. <AwsConsoleLink label="Create Lambda function in AWS" url={createLambdaUrl} className="ml-1" /></li>
                <li>Click <strong>Create function</strong>.</li>
                <li>Select <strong>Author from scratch</strong>.</li>
                <li>
                  Enter function name:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField
                      value={billingFileEventFunctionName}
                      copyKey="file-event-function-name"
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                      ariaLabel="Copy Lambda function name"
                    />
                  </span>
                </li>
                <li>
                  Select runtime:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField
                      value={billingFileEventRuntime}
                      copyKey="file-event-runtime"
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                      ariaLabel="Copy Lambda runtime"
                    />
                  </span>
                </li>
                <li>Click <strong>Create function</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">
                This Lambda sends KCX a file event when a new export manifest is created.
              </p>
            </InlineGuideStep>

            <InlineGuideStep title="Step 2: Add Lambda code" previewTitle="Replace Lambda code" previewContext="Replace Lambda code in the Code tab" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open the Lambda function and go to the <strong>Code</strong> tab.</li>
                <li>
                  Replace the default code with:{" "}
                  <InlineActionLink
                    label="View Billing File Event Lambda Code"
                    onClick={() =>
                      openPolicyDrawer("Billing File Event Lambda Code", billingFileEventLambdaCode, {
                        description: "This Node.js function:",
                        bullets: [
                          "reads S3 object-created events",
                          "filters to the configured export prefix",
                          "only processes manifest files under metadata/",
                          "posts the event to the KCX file callback endpoint",
                        ],
                      })
                    }
                  />
                </li>
                <li>Click <strong>Deploy</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">
                This code listens for S3 object-created events and only forwards manifest files in the export prefix to KCX.
              </p>
            </InlineGuideStep>

            <InlineGuideStep title="Step 3: Add environment variables" previewTitle="Add environment variables" previewContext="Configure Lambda environment variables" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Go to <strong>Configuration</strong> -&gt; <strong>Environment variables</strong>.</li>
                <li>Click <strong>Edit</strong>.</li>
                <li>
                  Add the required values:{" "}
                  <InlineActionLink
                    label="View Environment Variables"
                    onClick={() =>
                      openPolicyDrawer("Billing File Event Environment Variables", "", {
                        description: "Add these environment variables in Lambda.",
                        note: "Go to Lambda -> Configuration -> Environment variables -> Add all below.",
                        copyActionLabel: "Copy All Variables",
                        copyAllFromKeyValues: true,
                        keyValues: billingFileEventEnvironmentValues,
                      })
                    }
                  />
                </li>
                <li>Click <strong>Save</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">
                These environment variables tell the Lambda where to send file events and how to identify KCX billing export files.
              </p>
            </InlineGuideStep>

            <InlineGuideStep title="Step 4: Create EventBridge rule" previewTitle="Create EventBridge rule" previewContext="Create EventBridge rule for S3 object-created events" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open AWS EventBridge. <AwsConsoleLink label="Open EventBridge in AWS" url={eventBridgeRulesUrl} className="ml-1" /></li>
                <li>Go to <strong>Rules</strong> and click <strong>Create rule</strong>.</li>
                <li>
                  Enter rule name:{" "}
                  <span className="inline-flex align-middle">
                    <ReadonlyCopyField
                      value={form.eventBridgeRuleName}
                      copyKey="eventbridge-rule-name"
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                      ariaLabel="Copy EventBridge rule name"
                    />
                  </span>
                </li>
                <li>Select event source: <strong>AWS services</strong>, Service name: <strong>S3</strong>, Event type: <strong>Object Created</strong>.</li>
                <li>
                  Configure the event pattern:{" "}
                  <InlineActionLink
                    label="View EventBridge Event Pattern"
                    onClick={() =>
                      openPolicyDrawer("EventBridge Event Pattern", billingExportEventPattern, {
                        description: "This rule should only match object-created events from the billing export bucket and export prefix.",
                      })
                    }
                  />
                </li>
                <li>Set target to <strong>AWS service</strong> -&gt; <strong>Lambda function</strong>, then select your Lambda function.</li>
                <li>Click <strong>Create rule</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">
                This rule sends S3 object-created events from the billing export bucket to the Lambda function.
              </p>
            </InlineGuideStep>

            <InlineGuideStep title="Step 5: Paste Lambda ARN and test" previewTitle="Copy Lambda ARN" previewContext="Copy Lambda function ARN from function details" onOpenHelp={openHelpModal}>
              <ol className="list-decimal space-y-2 pl-4">
                <li>Open the Lambda function.</li>
                <li>Copy the <strong>Function ARN</strong>.</li>
                <li>Paste it below.</li>
                <li>Click <strong>Test Event Setup</strong>.</li>
              </ol>
              <p className="text-[12px] text-text-muted">
                We will verify that the Lambda is configured and ready to receive export file events.
              </p>

              <label className="mt-2 block space-y-1">
                <span className={LABEL_CLASS}>File Event Lambda ARN</span>
                <input
                  className={CONTROL_CLASS}
                  value={form.fileEventLambdaArn}
                  onChange={(event) => {
                    setField("fileEventLambdaArn", event.target.value)
                    setFileEventValidation("idle")
                  }}
                />
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="h-9 rounded-md"
                  onClick={() =>
                    simulateValidation(
                      setFileEventValidation,
                      Boolean(form.fileEventLambdaArn.trim() && form.eventBridgeRuleName.trim()),
                    )
                  }
                  disabled={fileEventValidation === "loading"}
                >
                  Test Event Setup
                </Button>
                <ValidationBanner
                  state={fileEventValidation}
                  idleText="Event test pending."
                  successText="File-event automation is ready."
                  errorText="Event setup test failed. Verify Lambda trigger wiring."
                />
              </div>
            </InlineGuideStep>
          </section>
        </div>
      ) : null}
      {currentStep === 4 ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
            <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableCloudTrail} onChange={(event) => setField("enableCloudTrail", event.target.checked)} />
            Enable CloudTrail ingestion
          </label>
          <OptionalSection enabled={form.enableCloudTrail} title="CloudTrail setup" description="Optional module for CloudTrail file ingestion.">
            <div className="space-y-0">
              <InlineGuideStep title="Step 1: Create S3 bucket" previewTitle="Create bucket in S3" previewContext="Create bucket in S3" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open AWS S3. <AwsConsoleLink label="Create bucket in AWS" url={createBucketUrl} className="ml-1" /></li>
                  <li>Click <strong>Create bucket</strong>.</li>
                  <li>Enter bucket name:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={form.cloudTrailBucket} copyKey="cloudtrail-bucket-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy CloudTrail bucket name" />
                    </span>
                  </li>
                  <li>Select region:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={form.awsRegion} copyKey="cloudtrail-bucket-region" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy AWS region" />
                    </span>
                  </li>
                  <li>Keep <strong>Block all public access</strong> enabled.</li>
                  <li>Enable <strong>Versioning</strong>.</li>
                  <li>Use default encryption (<strong>AES-256</strong>).</li>
                  <li>Click <strong>Create bucket</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">This bucket stores CloudTrail logs securely.</p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 2: Enable EventBridge for bucket" previewTitle="Enable EventBridge" previewContext="Enable EventBridge notifications in S3" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open the created bucket.</li>
                  <li>Go to <strong>Properties</strong>.</li>
                  <li>Scroll to <strong>Event notifications</strong>.</li>
                  <li>Enable <strong>EventBridge notifications</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">This allows S3 object-created events to trigger automation.</p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 3: Add bucket policy" previewTitle="Edit bucket policy" previewContext="Edit bucket policy in S3 permissions" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Go to <strong>Permissions</strong>.</li>
                  <li>Scroll to <strong>Bucket policy</strong>.</li>
                  <li>Click <strong>Edit</strong>.</li>
                  <li>Replace the policy with:
                    <div>
                      <InlineActionLink
                        label="View CloudTrail Bucket Policy"
                        onClick={() =>
                          openPolicyDrawer("CloudTrail Bucket Policy", generated.cloudTrailBucketPolicy, {
                            description: "This policy allows AWS CloudTrail to write logs into your S3 bucket.",
                            bullets: [
                              "Allows cloudtrail.amazonaws.com to check bucket ACL",
                              "Allows cloudtrail.amazonaws.com to write log objects",
                              "Restricts writes to the configured CloudTrail prefix and AWS account path",
                            ],
                          })
                        }
                        disabled={!requiredSetupValuesReady || !form.cloudTrailBucket.trim()}
                      />
                    </div>
                  </li>
                  <li>Click <strong>Save changes</strong>.</li>
                </ol>
              </InlineGuideStep>

              <InlineGuideStep title="Step 4: Create CloudTrail trail" previewTitle="Create CloudTrail trail" previewContext="Create trail in AWS CloudTrail" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open AWS CloudTrail. <AwsConsoleLink label="Open CloudTrail" url={cloudTrailUrl} className="ml-1" /></li>
                  <li>Click <strong>Create trail</strong>.</li>
                  <li>Enter trail name:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={form.trailName} copyKey="cloudtrail-trail-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy trail name" />
                    </span>
                  </li>
                  <li>Select <strong>Existing S3 bucket</strong> and choose the created bucket.</li>
                  <li>Enter prefix:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={form.cloudTrailPrefix} copyKey="cloudtrail-prefix" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy CloudTrail prefix" />
                    </span>
                  </li>
                  <li>Enable <strong>Multi-region trail</strong>.</li>
                  <li>Enable <strong>Include global service events</strong>.</li>
                  <li>Enable <strong>Log file validation</strong>.</li>
                  <li>Under events keep <strong>Management events</strong> enabled and <strong>Read/Write = All</strong>.</li>
                  <li>Click <strong>Create trail</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">
                  This trail writes management events for all regions into your CloudTrail bucket and prefix.
                </p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 5: Create Lambda function" previewTitle="Create Lambda function" previewContext="Create Lambda function in AWS Lambda" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open AWS Lambda. <AwsConsoleLink label="Create Lambda in AWS" url={createLambdaUrl} className="ml-1" /></li>
                  <li>Click <strong>Create function</strong>.</li>
                  <li>Select <strong>Author from scratch</strong>.</li>
                  <li>Enter function name:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={cloudTrailFunctionName} copyKey="cloudtrail-function-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy CloudTrail Lambda function name" />
                    </span>
                  </li>
                  <li>Select runtime:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={cloudTrailFunctionRuntime} copyKey="cloudtrail-function-runtime" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy CloudTrail Lambda runtime" />
                    </span>
                  </li>
                  <li>Click <strong>Create function</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">
                  This Lambda sends KCX a file event when a new CloudTrail log object is created.
                </p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 6: Add Lambda code" previewTitle="Replace Lambda code" previewContext="Replace Lambda code in the Code tab" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open the Lambda function and go to the <strong>Code</strong> tab.</li>
                  <li>Replace the default code with:
                    <div>
                      <InlineActionLink
                        label="View CloudTrail Event Lambda Code"
                        onClick={() =>
                          openPolicyDrawer("CloudTrail Event Lambda Code", generated.cloudTrailLambdaFunctionCode, {
                            description: "This Node.js function:",
                            bullets: [
                              "reads S3 object-created events",
                              "filters to the configured CloudTrail prefix",
                              "only processes CloudTrail log files under AWSLogs/",
                              "posts the event to the KCX file callback endpoint",
                            ],
                          })
                        }
                        disabled={!requiredSetupValuesReady}
                      />
                    </div>
                  </li>
                  <li>Click <strong>Deploy</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">
                  This code only forwards CloudTrail log objects that match the configured prefix.
                </p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 7: Add environment variables" previewTitle="Add environment variables" previewContext="Configure Lambda environment variables" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Go to <strong>Configuration</strong> -&gt; <strong>Environment variables</strong>.</li>
                  <li>Click <strong>Edit</strong>.</li>
                  <li>Add the required values:
                    <div>
                      <InlineActionLink
                        label="View Environment Variables"
                        onClick={() =>
                          openPolicyDrawer("CloudTrail Environment Variables", generated.cloudTrailLambdaEnvValues, {
                            description: "Add these environment variables in Lambda.",
                            note: "Go to Lambda -> Configuration -> Environment variables -> Add all below.",
                            copyActionLabel: "Copy All Variables",
                            copyAllFromKeyValues: true,
                            keyValues: cloudTrailEnvironmentValues,
                          })
                        }
                        disabled={!requiredSetupValuesReady || !form.billingRoleArn.trim()}
                      />
                    </div>
                  </li>
                  <li>Click <strong>Save</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">
                  These values tell the Lambda how to identify CloudTrail files and send them to KCX.
                </p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 8: Create EventBridge rule" previewTitle="Create EventBridge rule" previewContext="Create EventBridge rule for CloudTrail S3 object-created events" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open AWS EventBridge. <AwsConsoleLink label="Open EventBridge in AWS" url={eventBridgeRulesUrl} className="ml-1" /></li>
                  <li>Go to <strong>Rules</strong> and click <strong>Create rule</strong>.</li>
                  <li>Enter rule name:
                    <span className="ml-1 inline-flex align-middle">
                      <ReadonlyCopyField value={form.cloudTrailRuleName} copyKey="cloudtrail-eventbridge-rule-name" copiedKey={copiedKey} onCopy={copyToClipboard} ariaLabel="Copy CloudTrail EventBridge rule name" />
                    </span>
                  </li>
                  <li>Select event source:
                    <div className="pl-1 text-sm text-text-primary">
                      <div><strong>AWS services</strong></div>
                      <div>Service: <strong>S3</strong></div>
                      <div>Event type: <strong>Object Created</strong></div>
                    </div>
                  </li>
                  <li>Configure the event pattern:
                    <div>
                      <InlineActionLink
                        label="View EventBridge Event Pattern"
                        onClick={() =>
                          openPolicyDrawer("CloudTrail Event Pattern", cloudTrailEventPattern, {
                            description: "This rule should only match object-created events from the CloudTrail bucket and prefix.",
                          })
                        }
                        disabled={!requiredSetupValuesReady || !generated.cloudTrailEventBridgeParams.trim()}
                      />
                    </div>
                  </li>
                  <li>Set target to <strong>Lambda function</strong> and select the CloudTrail Lambda.</li>
                  <li>Click <strong>Create rule</strong>.</li>
                </ol>
                <p className="text-[12px] text-text-muted">
                  This rule forwards new CloudTrail objects from S3 to the Lambda function.
                </p>
              </InlineGuideStep>

              <InlineGuideStep title="Step 9: Paste Lambda ARN and validate" previewTitle="Copy Lambda ARN" previewContext="Copy Lambda function ARN from function details" onOpenHelp={openHelpModal}>
                <ol className="list-decimal space-y-2 pl-4">
                  <li>Open the Lambda function.</li>
                  <li>Copy the <strong>Function ARN</strong>.</li>
                  <li>Paste it below.</li>
                  <li>Click <strong>Validate CloudTrail</strong>.</li>
                </ol>
                <label className="mt-2 block space-y-1">
                  <span className={LABEL_CLASS}>CloudTrail Lambda ARN</span>
                  <input
                    className={CONTROL_CLASS}
                    value={form.cloudTrailLambdaArn}
                    onChange={(event) => {
                      setField("cloudTrailLambdaArn", event.target.value)
                      setCloudTrailValidation("idle")
                    }}
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setCloudTrailValidation, Boolean(form.trailName.trim() && form.cloudTrailBucket.trim()))} disabled={cloudTrailValidation === "loading"}>Validate CloudTrail</Button>
                  <ValidationBanner state={cloudTrailValidation} idleText="CloudTrail validation pending." successText="CloudTrail setup validated." errorText="Validation failed. Verify trail, policy, and event rule." />
                </div>
              </InlineGuideStep>
            </div>
          </OptionalSection>
        </div>
      ) : null}

      {currentStep === 5 ? (
        <SetupSummary
          form={form}
          derived={derived}
          billingValidation={billingValidation}
          exportValidation={exportValidation}
          fileEventValidation={fileEventValidation}
          cloudTrailValidation={cloudTrailValidation}
        />
      ) : null}

      <PolicyDrawer
        state={policyDrawer}
        copied={copiedKey === "policy-drawer-copy"}
        copiedKey={copiedKey}
        onOpenChange={(nextOpen) => setPolicyDrawer((current) => ({ ...current, open: nextOpen }))}
        onCopy={copyToClipboard}
      />

      <HelpModal
        state={helpModal}
        onOpenChange={(nextOpen) => setHelpModal((current) => ({ ...current, open: nextOpen }))}
      />

      {completeSetupError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {completeSetupError}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[color:var(--border-light)] bg-white px-3 py-2">
        <p className="text-xs text-text-muted">Step {currentStep + 1} of {STEPS.length}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-md" onClick={goBack} disabled={currentStep === 0}>
            <span className="inline-flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" />Back</span>
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button type="button" className="h-9 rounded-md" onClick={goNext} disabled={!canProceedFromStep}>
              <span className="inline-flex items-center gap-1.5">Next<ChevronRight className="h-4 w-4" /></span>
            </Button>
          ) : (
            <Button type="button" className="h-9 rounded-md" onClick={finishSetup} disabled={!canProceedFromStep || isCompletingSetup}>
              {isCompletingSetup ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Completing...
                </span>
              ) : (
                "Complete Setup"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function AwsManualSetup({ activeRoute }: { activeRoute: string }) {
  return <ManualSetupWizard activeRoute={activeRoute} />
}
