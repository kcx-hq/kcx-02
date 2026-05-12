import type { LucideIcon } from "lucide-react"
import { CloudUpload, ShieldCheck, Zap } from "lucide-react"

export const landingCloudProviders = [
  { label: "AWS" },
  { label: "GCP" },
  { label: "AWS" },
  { label: "GCP" },
] as const

export const landingHeroHighlights: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Upload, S3, or AWS Connect", icon: CloudUpload },
  { label: "Budgets & Anomaly Detection", icon: ShieldCheck },
  { label: "Recommendation Execution for AWS", icon: Zap },
]
