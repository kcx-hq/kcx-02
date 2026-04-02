import type { LucideIcon } from "lucide-react"
import { Clock3, FileText, Lock } from "lucide-react"

export const landingCloudProviders = [
  { label: "AWS" },
  { label: "Azure" },
  { label: "GCP" },
  { label: "Oracle" },
] as const

export const landingHeroHighlights: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Instant Audit", icon: Clock3 },
  { label: "CSV Upload", icon: FileText },
  { label: "Secure & Private", icon: Lock },
]
