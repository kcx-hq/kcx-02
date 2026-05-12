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
  { label: "Built for", value: "Finance, FinOps, and platform teams" },
  { label: "Designed for", value: "Trusted visibility, faster investigation, clearer prioritization" },
  { label: "Operational depth", value: "Selected AWS action workflows with tracked execution" },
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
        <Reveal className="mx-auto max-w-5xl" distance={18}>
          <div className="overflow-hidden rounded-none border border-[rgba(128,186,168,0.22)] bg-[linear-gradient(180deg,rgba(8,22,30,0.68)_0%,rgba(8,18,26,0.76)_100%)] shadow-[0_20px_44px_-32px_rgba(2,10,18,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]">
            {trustSignals.map((signal, index) => (
              <div
                key={signal.label}
                className="grid gap-2 px-4 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4 sm:px-5 sm:py-4"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(160,226,206,0.72)]">
                  {signal.label}
                </p>
                <p className="text-[13px] leading-[1.6] text-[rgba(228,242,237,0.9)] sm:text-[14px]">
                  {signal.value}
                </p>
                {index < trustSignals.length - 1 ? (
                  <div className="col-span-full h-px bg-[rgba(132,185,170,0.16)]" />
                ) : null}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.15} className="mx-auto mt-4 max-w-5xl rounded-none border border-[rgba(128,184,168,0.16)] bg-[rgba(8,20,29,0.55)] px-2 py-3 shadow-[0_16px_40px_-30px_rgba(2,10,18,0.8)] backdrop-blur-sm">
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
          <p className="mt-3 text-center text-[11px] leading-[1.6] text-[rgba(184,221,209,0.78)] sm:text-[12px]">
            Onboarding supports file upload, S3 import, and guided AWS connection. Operational
            automation is deepest for AWS today.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

