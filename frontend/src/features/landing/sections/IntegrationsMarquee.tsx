import awsIcon from "@/assets/icons/aws.svg"
import azureIcon from "@/assets/icons/azure.svg"
import gcpIcon from "@/assets/icons/gcp.svg"
import oracleIcon from "@/assets/icons/oracle.svg"
import { Reveal } from "@/components/motion/Reveal"
import { landingSectionIds } from "@/features/landing/utils/landingSectionIds"

const ecosystems = [
  { key: "gcp", label: "GCP", src: gcpIcon },
  { key: "oracle", label: "ORACLE", src: oracleIcon },
  { key: "aws", label: "AWS", src: awsIcon },
  { key: "azure", label: "AZURE", src: azureIcon },
]

const trustSignals = [
  { label: "Shared visibility", value: "Finance, FinOps, and platform leadership" },
  { label: "Validated onboarding", value: "Upload, S3, or guided AWS connection" },
  { label: "One workspace", value: "Budgets, anomalies, and optimization workflows" },
]

export function IntegrationsMarquee() {
  const integrations = Array.from({ length: 7 }, (_, batchIndex) =>
    ecosystems.map((item, itemIndex) => ({
      ...item,
      key: `${item.key}-${batchIndex}-${itemIndex}`,
    }))
  ).flat()

  const marqueeSet = [...integrations, ...integrations]

  return (
    <section
      id={landingSectionIds.integrations}
      data-header-theme="dark"
      className="kcx-section-dark relative overflow-hidden border-y border-[rgba(132,185,170,0.16)] py-8 sm:py-9 md:py-10"
      aria-label="Supported cloud ecosystem integrations"
    >
      <div className="kcx-section-mist" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(112,172,153,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(112,172,153,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="kcx-container relative">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-3xl" distance={18}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(176,232,216,0.8)]">
              One Operating Layer
            </p>
            <p className="mt-2.5 text-sm leading-[1.7] text-[rgba(210,229,224,0.78)] sm:text-[15px]">
              KCX gives cloud teams a shared workspace for onboarding billing data, validating cost
              intelligence, and moving from visibility to prioritized action.
            </p>
            <p className="mt-2.5 text-sm leading-[1.7] text-[rgba(210,229,224,0.74)] sm:text-[15px]">
              Built for organizations that need more than static cloud cost reporting. KCX helps
              teams align on trusted spend data, investigate changes faster, and operate FinOps with
              clearer governance and next-step execution.
            </p>
            <p className="mt-2.5 text-[12px] leading-[1.65] text-[rgba(176,232,216,0.8)] sm:text-[13px]">
              Operational automation today is deepest for AWS.
            </p>
            <a
              href={`#${landingSectionIds.works}`}
              className="mt-4 inline-flex items-center rounded-lg border border-[rgba(132,195,175,0.24)] bg-[rgba(11,30,40,0.58)] px-4 py-2 text-[13px] font-semibold text-[rgba(224,241,234,0.9)] transition-colors duration-200 hover:border-[rgba(132,195,175,0.38)] hover:text-[rgba(238,248,244,0.96)]"
            >
              See How KCX Works
            </a>
          </Reveal>

          <Reveal delay={0.1} className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:min-w-[34rem] lg:grid-cols-3">
            {trustSignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-xl border border-[rgba(132,195,175,0.2)] bg-[rgba(10,25,34,0.6)] px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(160,226,206,0.72)]">
                  {signal.label}
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-[rgba(227,241,236,0.9)]">{signal.value}</p>
              </div>
            ))}
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-6 rounded-2xl border border-[rgba(128,184,168,0.16)] bg-[rgba(8,20,29,0.55)] px-2 py-3 shadow-[0_16px_40px_-30px_rgba(2,10,18,0.8)] backdrop-blur-sm">
          <div className="integrations-band-viewport">
            <div className="integrations-band-track">
              {marqueeSet.map((item, index) => (
                <div className="integrations-band-item" key={`${item.key}-clone-${index}`}>
                  <img src={item.src} alt={item.label} className="integrations-band-logo" loading="lazy" />
                  <span className="integrations-band-name">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
