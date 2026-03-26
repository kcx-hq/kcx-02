import { SiteFooter } from "@/components/layout/SiteFooter"

export function PageFooter() {
  return (
    <div
      data-header-theme="dark"
      className="relative overflow-hidden bg-[linear-gradient(180deg,#050d17_0%,#050c15_36%,#040a12_100%)] text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_42%_at_76%_12%,rgba(95,188,162,0.12),transparent_72%),radial-gradient(56%_34%_at_20%_34%,rgba(63,128,188,0.1),transparent_74%)]" />
      <div className="relative">
        <SiteFooter />
      </div>
    </div>
  )
}
