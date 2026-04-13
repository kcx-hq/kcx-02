import { AuroraBackground } from "@/components/brand/AuroraBackground"
import { Button } from "@/components/ui/button"
import { AwsIntegrationCtaSection } from "@/features/landing/sections/aws/AwsIntegrationCtaSection"
import { AwsSystemCapabilitiesSection } from "@/features/landing/sections/aws/AwsSystemCapabilitiesSection"
import { AwsValueSection } from "@/features/landing/sections/aws/AwsValueSection"
import { PageFooter } from "@/components/layout/PageFooter"

function AwsHeroVisual() {
  const boxBaseClass =
    "absolute flex h-16 w-16 items-center justify-center border border-[rgba(176,211,199,0.45)] bg-[rgba(10,24,35,0.44)]"
  const serviceLabelClass = "text-[11px] font-medium tracking-tight text-[rgba(219,236,230,0.95)]"

  return (
    <aside className="relative flex items-center justify-center">
      <div className="relative" style={{ width: 404, height: 366 }}>
        <div className="absolute left-[146px] top-[110px] flex h-32 w-32 items-center justify-center border border-[rgba(194,226,216,0.55)] bg-[rgba(233,244,240,0.92)] shadow-[0_16px_34px_-20px_rgba(3,12,18,0.65)]">
          <img src="/aws.svg" alt="AWS" className="h-10 w-auto object-contain" />
        </div>

        <div className={boxBaseClass} style={{ left: 82, top: 46 }}>
          <span className={serviceLabelClass}>Billing</span>
        </div>
        <div className={boxBaseClass} style={{ left: 274, top: 46 }}>
          <span className={serviceLabelClass}>Govern</span>
        </div>
        <div className={boxBaseClass} style={{ left: 82, top: 238 }}>
          <span className={serviceLabelClass}>Compute</span>
        </div>
        <div className={boxBaseClass} style={{ left: 274, top: 238 }}>
          <span className={serviceLabelClass}>Storage</span>
        </div>

        <div className={boxBaseClass} style={{ left: 18, top: -18 }}>
          <span className={serviceLabelClass}>CUR</span>
        </div>
        <div className={boxBaseClass} style={{ left: 18, top: 110 }}>
          <span className={serviceLabelClass}>Focus</span>
        </div>
        <div className={boxBaseClass} style={{ left: 210, top: -18 }}>
          <span className={serviceLabelClass}>IAM</span>
        </div>
        <div className={boxBaseClass} style={{ left: 338, top: -18 }}>
          <span className={`${serviceLabelClass} text-[10px]`}>CloudWatch</span>
        </div>
        <div className={boxBaseClass} style={{ left: 18, top: 302 }}>
          <span className={serviceLabelClass}>EBS</span>
        </div>
        <div className={boxBaseClass} style={{ left: 146, top: 302 }}>
          <span className={serviceLabelClass}>EC2</span>
        </div>
        <div className={boxBaseClass} style={{ left: 338, top: 174 }}>
          <span className={serviceLabelClass}>S3</span>
        </div>
        <div className={boxBaseClass} style={{ left: 338, top: 302 }}>
          <span className={serviceLabelClass}>RDS</span>
        </div>
      </div>
    </aside>
  )
}
export function AwsIntegrationPage() {
  return (
    <>
      <section
        data-header-theme="dark"
        className="relative isolate overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#07121c_0%,#081724_46%,#0b1f2f_100%)] pb-14 pt-24 md:pb-16 md:pt-28"
      >
        <AuroraBackground />

        {/* Subtle grid pattern overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 md:px-10 lg:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.18fr_0.82fr] lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(154,223,199,0.92)]">
                Integrations / AWS
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-[3.35rem] md:leading-[1.08]">
                Bring clarity and control to your AWS cloud spend
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[rgba(226,239,234,0.92)]">
                Gain cost visibility, prioritize optimization opportunities, and turn AWS billing data into structured
                FinOps insights your teams can act on.
              </p>
              <Button className="mt-8 bg-[#3e8a76] px-6 text-white shadow-none hover:bg-[#357563] hover:shadow-none">
                Schedule Demo
              </Button>
            </div>

            <AwsHeroVisual />
          </div>
        </div>
      </section>

      <AwsValueSection />
      <AwsSystemCapabilitiesSection />
      <AwsIntegrationCtaSection />
      <PageFooter />
    </>
  )
}


