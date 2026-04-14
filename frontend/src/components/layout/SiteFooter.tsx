import { Github, Linkedin, Twitter } from "lucide-react"

import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { Reveal } from "@/components/motion/Reveal"

const footerColumns = [
  {
    title: "Platform",
    links: [
      { label: "Overview", href: "#" },
      { label: "Data Onboarding", href: "#" },
      { label: "Cost Intelligence", href: "#" },
      { label: "Anomaly Detection", href: "#" },
      { label: "Optimization Actions", href: "#" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Finance Leaders", href: "#" },
      { label: "FinOps Teams", href: "#" },
      { label: "Platform Engineering", href: "#" },
      { label: "Cloud Operations", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FinOps Maturity", href: "#" },
      { label: "Documentation", href: "/resources/documentation" },
      { label: "Implementation Guide", href: "#" },
      { label: "Blog", href: "/resources/blog" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer
      id="footer"
      data-header-theme="dark"
      className="kcx-section-dark relative overflow-hidden border-t border-[rgba(120,196,171,0.18)] py-16 sm:py-20"
    >
      <div className="kcx-section-mist opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,13,20,0)_0%,rgba(3,8,13,0.5)_100%)]" />

      <div className="kcx-container relative z-10">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.18fr)_repeat(3,minmax(0,1fr))] lg:gap-14">
          <Reveal className="max-w-[24rem]">
            <div className="flex items-center gap-3">
              <img src={kcxLogo} alt="KCX logo" className="h-11 w-auto" />
              <div>
                <p className="kcx-heading text-[1.9rem] font-semibold leading-none tracking-tight text-white">
                  KC<span className="text-[rgba(84,186,154,0.95)]">X</span>
                </p>
                <p className="mt-1 text-[0.78rem] leading-none text-[rgba(168,236,216,0.8)]">
                  FinOps Platform
                </p>
              </div>
            </div>

            <p className="mt-6 text-[0.88rem] leading-[1.6] text-[rgba(198,217,226,0.82)]">
              Trusted FinOps operations from onboarding to validated cost intelligence, optimization, and selected AWS action workflows.
            </p>

            <p className="mt-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[rgba(214,236,228,0.82)]">
              Subscribe to updates
            </p>

            <form className="mt-3 grid h-12 w-full grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-white/[0.12] bg-[rgba(8,18,26,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-email"
                type="email"
                placeholder="Email address"
                className="h-full min-w-0 bg-transparent px-4 text-[0.9rem] text-[rgba(230,241,238,0.9)] outline-none placeholder:text-[rgba(140,162,175,0.7)] focus:placeholder:text-[rgba(140,162,175,0.5)]"
              />
              <button
                type="submit"
                className="flex h-full items-center justify-center border-l border-white/[0.1] bg-[rgba(62,138,118,0.85)] px-5 text-[0.85rem] font-semibold text-white transition-all duration-200 hover:bg-[rgba(62,138,118,1)]"
              >
                Join
              </button>
            </form>
          </Reveal>

          {footerColumns.map((column, index) => (
            <Reveal key={column.title} delay={0.05 * (index + 1)}>
              <p className="kcx-heading text-[1.05rem] font-semibold tracking-tight text-white">{column.title}</p>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <a
                      href={link.href}
                      className="text-[0.9rem] text-[rgba(202,224,218,0.65)] transition-colors duration-200 hover:text-[rgba(177,240,222,0.92)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              {index === footerColumns.length - 1 ? (
                <div className="mt-7 flex items-center gap-2.5">
                  <a
                    href="#"
                    aria-label="LinkedIn"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(131,210,187,0.2)] bg-[rgba(9,24,32,0.65)] text-[rgba(205,230,223,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(131,210,187,0.35)] hover:text-[rgba(177,240,222,0.92)]"
                  >
                    <Linkedin className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </a>
                  <a
                    href="#"
                    aria-label="Twitter"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(131,210,187,0.2)] bg-[rgba(9,24,32,0.65)] text-[rgba(205,230,223,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(131,210,187,0.35)] hover:text-[rgba(177,240,222,0.92)]"
                  >
                    <Twitter className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </a>
                  <a
                    href="#"
                    aria-label="GitHub"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(131,210,187,0.2)] bg-[rgba(9,24,32,0.65)] text-[rgba(205,230,223,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(131,210,187,0.35)] hover:text-[rgba(177,240,222,0.92)]"
                  >
                    <Github className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </a>
                </div>
              ) : null}
            </Reveal>
          ))}
        </div>

        <div className="mt-14 border-t border-[rgba(120,196,171,0.14)] pt-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[13px] text-[rgba(204,228,221,0.6)]">
              © {new Date().getFullYear()} KCX FinOps Platform. All rights reserved.
            </p>
            <div className="flex items-center justify-center gap-6 text-[13px] text-[rgba(205,230,223,0.55)]">
              <a href="#" className="transition-colors duration-200 hover:text-[rgba(177,240,222,0.9)]">
                Privacy
              </a>
              <a href="#" className="transition-colors duration-200 hover:text-[rgba(177,240,222,0.9)]">
                Terms
              </a>
              <a href="#" className="transition-colors duration-200 hover:text-[rgba(177,240,222,0.9)]">
                Security
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

