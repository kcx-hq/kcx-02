import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  "Billing Role",
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

function GeneratedBlock({
  title,
  content,
  copyKey,
  copiedKey,
  onCopy,
  disabled,
  helper,
}: {
  title: string
  content: string
  copyKey: string
  copiedKey: string | null
  onCopy: (copyKey: string, value: string) => void
  disabled?: boolean
  helper?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <CopyButton onCopy={() => onCopy(copyKey, content)} copied={copiedKey === copyKey} disabled={disabled || !content.trim()} />
      </div>
      {disabled ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          {helper ?? "Complete required values first."}
        </div>
      ) : null}
      <pre className="max-h-80 overflow-auto rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-xs leading-relaxed text-text-primary">
        <code>{content}</code>
      </pre>
    </div>
  )
}

function PolicyBlock(props: Parameters<typeof GeneratedBlock>[0]) {
  return <GeneratedBlock {...props} />
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
      enableActionRole: false,
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

  function simulateValidation(setter: Dispatch<SetStateAction<ValidationState>>, success: boolean) {
    setter("loading")
    // TODO: Replace mock validation with backend validation endpoints when available.
    window.setTimeout(() => setter(success ? "success" : "error"), 900)
  }
  const canProceedFromStep = useMemo(() => {
    if (currentStep === 0) return requiredSetupValuesReady
    if (currentStep === 1) return form.billingRoleArn.trim().length > 0 && billingValidation === "success"
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
          <section className="space-y-2">
            <p className={SECTION_TITLE_CLASS}>Setup Values</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>External ID</span>
                <input className={CONTROL_CLASS} value={form.externalId} onChange={(event) => setField("externalId", event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className={LABEL_CLASS}>Connection Name</span>
                <input className={CONTROL_CLASS} value={form.connectionName} onChange={(event) => setField("connectionName", event.target.value)} />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className={LABEL_CLASS}>KCX Principal ARN</span>
                <input className={CONTROL_CLASS} value={form.kcxPrincipalArn} onChange={(event) => setField("kcxPrincipalArn", event.target.value)} />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className={LABEL_CLASS}>File Event Callback URL</span>
                <input className={CONTROL_CLASS} value={form.fileEventCallbackUrl} onChange={(event) => setField("fileEventCallbackUrl", event.target.value)} />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className={LABEL_CLASS}>Callback Token</span>
                <input className={CONTROL_CLASS} value={form.callbackToken} onChange={(event) => setField("callbackToken", event.target.value)} />
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

          <section className="space-y-2 border-t border-[color:var(--border-light)] pt-3">
            <p className={SECTION_TITLE_CLASS}>Options</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableCloudTrail} onChange={(event) => setField("enableCloudTrail", event.target.checked)} />
                Enable CloudTrail
              </label>
              <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableActionRole} onChange={(event) => setField("enableActionRole", event.target.checked)} />
                Enable Action Role
              </label>
              <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableEc2Module} onChange={(event) => setField("enableEc2Module", event.target.checked)} />
                Enable EC2 Module
              </label>
              <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.useTagScopedAccess} onChange={(event) => setField("useTagScopedAccess", event.target.checked)} />
                Use tag-scoped access
              </label>
            </div>
          </section>
          <section className="space-y-2 border-t border-[color:var(--border-light)] pt-3">
            <p className={SECTION_TITLE_CLASS}>Derived Values</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ValueCard label="Billing role name" value={derived.billingRoleName} copyKey="d1" copiedKey={copiedKey} onCopy={copyToClipboard} />
              {form.enableActionRole ? <ValueCard label="Action role name" value={derived.actionRoleName} copyKey="d2" copiedKey={copiedKey} onCopy={copyToClipboard} /> : null}
              <ValueCard label="Export bucket name" value={derived.exportBucketName} copyKey="d3" copiedKey={copiedKey} onCopy={copyToClipboard} />
              {form.enableCloudTrail ? <ValueCard label="CloudTrail bucket name" value={derived.cloudTrailBucketName} copyKey="d4" copiedKey={copiedKey} onCopy={copyToClipboard} /> : null}
              <ValueCard label="Export prefix" value={derived.exportPrefix} copyKey="d5" copiedKey={copiedKey} onCopy={copyToClipboard} />
              {form.enableCloudTrail ? <ValueCard label="CloudTrail prefix" value={derived.cloudTrailPrefix} copyKey="d6" copiedKey={copiedKey} onCopy={copyToClipboard} /> : null}
            </div>
          </section>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="space-y-3">
          <ValueCard label="Billing role name" value={derived.billingRoleName} copyKey="brn" copiedKey={copiedKey} onCopy={copyToClipboard} />
          <PolicyBlock title="Billing Role Trust Policy" content={generated.billingRoleTrustPolicy} copyKey="brtp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="External ID, KCX principal ARN, account ID, and region are required." />
          <PolicyBlock title="Billing Role Permissions Policy" content={generated.billingRolePermissionsPolicy} copyKey="brpp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values and export bucket values are required." />

          {form.enableActionRole ? (
            <details className="rounded-[10px] border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Action Role (Enabled)</summary>
              <div className="mt-3 space-y-3 border-t border-[color:var(--border-light)] pt-3">
                <ValueCard label="Action role name" value={derived.actionRoleName} copyKey="arn" copiedKey={copiedKey} onCopy={copyToClipboard} />
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Action Role ARN</span>
                  <input
                    className={CONTROL_CLASS}
                    value={form.actionRoleArn}
                    onChange={(event) => setField("actionRoleArn", event.target.value)}
                    placeholder={`arn:aws:iam::${form.awsAccountId || "123456789012"}:role/${derived.actionRoleName}`}
                  />
                </label>
                <PolicyBlock title="Action Role Trust Policy" content={generated.actionRoleTrustPolicy} copyKey="artp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." />
                <PolicyBlock title="Action Role Base Permissions Policy" content={generated.actionRoleBasePermissionsPolicy} copyKey="arbp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." />
                {form.enableEc2Module ? <PolicyBlock title="EC2 Module Policy" content={generated.ec2ModulePolicy} copyKey="ec2p" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." /> : null}
              </div>
            </details>
          ) : null}

          <label className="space-y-1">
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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setBillingValidation, form.billingRoleArn.includes(derived.billingRoleName))} disabled={!form.billingRoleArn.trim() || billingValidation === "loading"}>Validate Role</Button>
            <ValidationBanner state={billingValidation} idleText="Validation pending." successText="Billing role validated." errorText="Validation failed. Verify trust policy and ARN." />
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="space-y-3">
          <section className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">Create AWS Data Export</p>
            <div className="rounded-md bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-text-secondary">Checklist: Create export bucket, add bucket policy, then create Data Export.</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className={LABEL_CLASS}>Export bucket</span><input className={CONTROL_CLASS} value={form.exportBucket} onChange={(event) => setField("exportBucket", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>Export prefix</span><input className={CONTROL_CLASS} value={form.exportPrefix} onChange={(event) => setField("exportPrefix", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>Region</span><input className={CONTROL_CLASS} value={form.exportRegion} onChange={(event) => setField("exportRegion", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>Export name</span><input className={CONTROL_CLASS} value={form.exportName} onChange={(event) => setField("exportName", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>Export ARN</span><input className={CONTROL_CLASS} value={form.exportArn} onChange={(event) => setField("exportArn", event.target.value)} /></label>
            </div>
          </section>

          <ValueCard label="Export bucket name" value={form.exportBucket} copyKey="ebn" copiedKey={copiedKey} onCopy={copyToClipboard} />
          <PolicyBlock title="Export Bucket Policy" content={generated.exportBucketPolicy} copyKey="ebp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady || !form.exportBucket.trim()} helper="Setup values and export bucket are required." />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setExportValidation, Boolean((form.exportName.trim() || form.exportArn.trim()) && form.exportBucket.trim()))} disabled={exportValidation === "loading"}>Validate Export</Button>
            <ValidationBanner state={exportValidation} idleText="Export validation pending." successText="Export configuration validated." errorText="Validation failed. Review bucket policy and export setup." />
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="space-y-3">
          <div className="rounded-[10px] border border-[color:var(--brand-primary)] bg-[color:var(--brand-soft)] px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-brand-primary" />
              <p className="text-sm font-medium text-text-primary">File Event Automation is required for automatic ingestion.</p>
            </div>
          </div>
          <label className="space-y-1"><span className={LABEL_CLASS}>File Event Lambda ARN</span><input className={CONTROL_CLASS} value={form.fileEventLambdaArn} onChange={(event) => { setField("fileEventLambdaArn", event.target.value); setFileEventValidation("idle") }} /></label>
          <label className="space-y-1"><span className={LABEL_CLASS}>EventBridge rule name</span><input className={CONTROL_CLASS} value={form.eventBridgeRuleName} onChange={(event) => { setField("eventBridgeRuleName", event.target.value); setFileEventValidation("idle") }} /></label>
          <GeneratedBlock title="Billing Lambda Function Code (Node.js)" content={generated.billingLambdaFunctionCode} copyKey="blfc" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." />
          <GeneratedBlock title="Billing File-Event Lambda Environment Values" content={generated.billingLambdaEnvValues} copyKey="blev" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady || !form.billingRoleArn.trim()} helper="Setup values and Billing Role ARN are required." />
          <GeneratedBlock title="Suggested EventBridge Rule Parameters" content={generated.billingEventBridgeParams} copyKey="bebp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." />
          <div className="flex flex-wrap items-center gap-2"><Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setFileEventValidation, Boolean(form.fileEventLambdaArn.trim() && form.eventBridgeRuleName.trim()))} disabled={fileEventValidation === "loading"}>Test Event Setup</Button><ValidationBanner state={fileEventValidation} idleText="Event test pending." successText="File-event automation is ready." errorText="Event setup test failed. Verify Lambda trigger wiring." /></div>
        </div>
      ) : null}
      {currentStep === 4 ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-md border border-[color:var(--border-light)] bg-white px-3 py-2 text-sm text-text-primary">
            <input type="checkbox" className="h-4 w-4 accent-[color:var(--brand-primary)]" checked={form.enableCloudTrail} onChange={(event) => setField("enableCloudTrail", event.target.checked)} />
            Enable CloudTrail ingestion
          </label>
          <OptionalSection enabled={form.enableCloudTrail} title="CloudTrail setup" description="Optional module for CloudTrail file ingestion.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className={LABEL_CLASS}>CloudTrail bucket</span><input className={CONTROL_CLASS} value={form.cloudTrailBucket} onChange={(event) => setField("cloudTrailBucket", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>CloudTrail prefix</span><input className={CONTROL_CLASS} value={form.cloudTrailPrefix} onChange={(event) => setField("cloudTrailPrefix", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>Trail name</span><input className={CONTROL_CLASS} value={form.trailName} onChange={(event) => setField("trailName", event.target.value)} /></label>
              <label className="space-y-1"><span className={LABEL_CLASS}>CloudTrail Lambda ARN</span><input className={CONTROL_CLASS} value={form.cloudTrailLambdaArn} onChange={(event) => setField("cloudTrailLambdaArn", event.target.value)} /></label>
              <label className="space-y-1 md:col-span-2"><span className={LABEL_CLASS}>CloudTrail EventBridge rule name</span><input className={CONTROL_CLASS} value={form.cloudTrailRuleName} onChange={(event) => setField("cloudTrailRuleName", event.target.value)} /></label>
            </div>
            <GeneratedBlock title="CloudTrail Bucket Name" content={form.cloudTrailBucket} copyKey="ctbn" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!form.cloudTrailBucket.trim()} helper="Provide CloudTrail bucket name." />
            <PolicyBlock title="CloudTrail Bucket Policy" content={generated.cloudTrailBucketPolicy} copyKey="ctbp" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady || !form.cloudTrailBucket.trim()} helper="Setup values and CloudTrail bucket are required." />
            <GeneratedBlock title="CloudTrail Lambda Function Code (Node.js)" content={generated.cloudTrailLambdaFunctionCode} copyKey="ctlfc" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." />
            <GeneratedBlock title="CloudTrail File-Event Lambda Environment Values" content={generated.cloudTrailLambdaEnvValues} copyKey="ctenv" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady || !form.billingRoleArn.trim()} helper="Setup values and Billing Role ARN are required." />
            <GeneratedBlock title="CloudTrail EventBridge Rule Parameters" content={generated.cloudTrailEventBridgeParams} copyKey="ctev" copiedKey={copiedKey} onCopy={copyToClipboard} disabled={!requiredSetupValuesReady} helper="Setup values are required." />
            <div className="flex flex-wrap items-center gap-2"><Button type="button" className="h-9 rounded-md" onClick={() => simulateValidation(setCloudTrailValidation, Boolean(form.trailName.trim() && form.cloudTrailBucket.trim()))} disabled={cloudTrailValidation === "loading"}>Validate CloudTrail</Button><ValidationBanner state={cloudTrailValidation} idleText="CloudTrail validation pending." successText="CloudTrail setup validated." errorText="Validation failed. Verify trail, policy, and event rule." /></div>
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
