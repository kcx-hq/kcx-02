import { useEffect, useMemo, useRef, useState } from "react"
import { Menu, X } from "lucide-react"

import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { MegaMenu, type MegaMenuData } from "@/components/layout/MegaMenu"
import { NavItem } from "@/components/layout/NavItem"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { useActiveSectionTheme } from "@/hooks/useActiveSectionTheme"
import { handleAppLinkClick, isBlogDetailPath, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const NAV_MENUS: MegaMenuData[] = [
  {
    key: "platform",
    label: "Platform",
    groups: [
      {
        title: "Overview",
        links: [
          {
            title: "Core Platform",
            href: "#",
            description: "Visibility, controls, and cost intelligence.",
            icon: "/icons/core-platform.png",
          },
          { title: "Real-time Insights", href: "#", description: "Monitor usage and spend trends continuously.",
            icon: "/icons/real-time-insights.png",
           },
          { title: "Governance", href: "#", description: "Enforce guardrails across teams and accounts.",
            icon: "/icons/governance.png",
          },
        ],
      },
      {
        title: "Capabilities",
        links: [
          { title: "Cost Explorer", href: "#", icon: "/icons/cost-explorer.png" },
          { title: "Anomaly Detection", href: "#", icon: "/icons/anomaly-detection.png" },
          { title: "Optimization Signals", href: "#", icon: "/icons/optimization-signals.png" },
        ],
      },
    ],
    featured: {
      title: "See platform architecture",
      description: "Explore how KCX unifies finance and engineering context into one decision layer.",
      ctaLabel: "View platform",
      href: "#",
    },
  },
  {
    key: "solutions",
    label: "Solutions",
    groups: [
      {
        title: "Use Cases",
        links: [
          {
            title: "FinOps Snapshot",
            href: "#",
            description: "Fast baseline from exported billing data.",
            icon: "/icons/finops-snapshot.png",
          },
          {
            title: "Continuous Optimization",
            href: "#",
            description: "Sustained efficiency across environments.",
            icon: "/icons/continuous-optimization.png",
          },
          {
            title: "Budget Guardrails",
            href: "#",
            description: "Prevent overrun before month-end surprises.",
            icon: "/icons/budget-guardrails.png",
          },
        ],
      },
      {
        title: "Teams",
        links: [
          { title: "Finance", href: "#", icon: "/icons/finance-team.png" },
          { title: "Engineering", href: "#", icon: "/icons/engineering-team.png" },
          { title: "Leadership & Ownership", href: "#", icon: "/icons/leadership-ownership.png" },
        ],
      },
    ],
    featured: {
      title: "Map solutions by maturity",
      description: "Start with quick wins and scale into continuous optimization workflows.",
      ctaLabel: "Explore solutions",
      href: "#",
    },
  },
  {
    key: "integrations",
    label: "Integrations",
    groups: [
      {
        title: "Cloud Sercive Providers",
        links: [
          {
            title: "Amazon Web Services",
            href: "/integrations/aws",
            icon: "/icons/aws.png",
            iconClassName: "integration-icon",
          },
          { title: "Microsoft Azure", href: "#", icon: "/icons/azure.png", iconClassName: "integration-icon" },
          {
            title: "Google Cloud Platform",
            href: "#",
            icon: "/icons/google-cloud.png",
            iconClassName: "integration-icon",
          },
          {
            title: "Oracle Cloud",
            href: "#",
            icon: "/icons/oracle.png",
            iconScale: 1.35,
            iconClassName: "integration-icon",
          },
        ],
      },
      {
        title: "Data Processing",
        links: [
          { title: "CSV Ingestion", href: "#", icon: "/icons/csv-ingestion.png", iconClassName: "integration-icon" },
          { title: "Exports API", href: "#", icon: "/icons/api-export.png", iconClassName: "integration-icon" },
          { title: "Scheduled Sync", href: "#", icon: "/icons/scheduled-sync.png", iconClassName: "integration-icon" },
        ],
      },
    ],
    featured: {
      title: "Bring your cloud data",
      description: "Connect your provider exports and enrich with ownership and context.",
      ctaLabel: "View integrations",
      href: "#",
    },
  },
  {
    key: "company",
    label: "Company",
    groups: [
      {
        title: "About KCX",
        links: [
          { title: "Our Story", href: "/about/our-story", icon: "/icons/our-story.png" },
          { title: "Leadership", href: "/about/leadership", icon: "/icons/leadership.png" },
          { title: "Careers", href: "/about/careers", icon: "/icons/career.png" },
        ],
      },
      {
        title: "Resources",
        links: [
          { title: "Blog", href: "/resources/blog", icon: "/icons/blog.png" },
          { title: "Documentation", href: "/resources/documentation", icon: "/icons/documentation.png" },
          
        ],
      },
    ],
    featured: {
      title: "Get to know KCX",
      description: "Learn how KCX helps teams make clearer cloud decisions.",
      ctaLabel: "Browse docs",
      href: "/resources/documentation",
    },
  },
]

type HeaderTone = "light" | "dark"
const SCROLL_THRESHOLD = 64

export function Header() {
  const route = useCurrentRoute()
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const activeSectionTheme = useActiveSectionTheme({
    defaultTheme: "dark",
    stickyOffsetPx: isScrolled ? 94 : 84,
  })

  const activeMenu = useMemo(
    () => NAV_MENUS.find((menu) => menu.key === openMenuKey) ?? null,
    [openMenuKey]
  )
  const forceVisibleShell = isBlogDetailPath(route)
  const shellVisible = isScrolled || forceVisibleShell
  const contentTone: HeaderTone =
    !shellVisible ? "dark" : activeSectionTheme === "dark" ? "light" : "dark"

  const handleNavClose = () => {
    setOpenMenuKey(null)
  }

  const handleMobileClose = () => {
    setMobileOpen(false)
    setOpenMenuKey(null)
  }

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const openMenu = (key: string) => {
    clearCloseTimer()
    setOpenMenuKey(key)
  }

  const scheduleCloseMenu = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => {
      setOpenMenuKey(null)
    }, 140)
  }

  const toggleMenuByClick = (key: string) => {
    clearCloseTimer()
    setOpenMenuKey((current) => (current === key ? null : key))
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setIsScrolled((current) => (current ? y > SCROLL_THRESHOLD - 18 : y > SCROLL_THRESHOLD))
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!headerRef.current) return
      if (!headerRef.current.contains(event.target as Node)) {
        setOpenMenuKey(null)
      }
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuKey(null)
        setMobileOpen(false)
      }
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onEscape)
    }
  }, [])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 z-50 transition-[top,padding] duration-300 ease-out",
        shellVisible ? "top-3 px-4 md:px-6" : "top-0 px-2 pt-3 md:px-4 md:pt-4"
      )}
    >
      <div
        ref={headerRef}
        className={cn(
          "relative mx-auto w-full transition-all duration-300 ease-out",
          shellVisible
            ? "max-w-[min(1140px,calc(100vw-1.5rem))] rounded-2xl px-5 md:px-6"
            : "max-w-[min(1420px,calc(100vw-1rem))] rounded-2xl px-4 md:px-6",
          shellVisible ? "py-2.5" : "py-3.5"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-2xl transition-all duration-300 ease-out",
            contentTone === "light"
              ? "border border-[rgba(21,37,49,0.14)] bg-[rgba(247,250,249,0.97)] shadow-[0_22px_44px_-26px_rgba(15,23,42,0.35)] backdrop-blur-sm"
              : "border border-[rgba(226,240,236,0.24)] bg-[rgba(7,18,28,0.78)] shadow-[0_28px_56px_-30px_rgba(0,7,14,0.8)] backdrop-blur-md",
            shellVisible ? "scale-100 opacity-100" : "scale-[0.96] opacity-0"
          )}
        />

        <div
          className={cn(
            "relative z-10 flex items-center justify-between transition-[gap] duration-300 ease-out",
            shellVisible ? "gap-4" : "gap-7"
          )}
        >
          <a
            href="/"
            onClick={(event) => handleAppLinkClick(event, "/", handleMobileClose)}
            className={cn(
              "inline-flex shrink-0 items-center transition-[gap] duration-300 lg:min-w-[18rem]",
              shellVisible ? "gap-2.5" : "gap-3"
            )}
          >
            <img
              src={kcxLogo}
              alt="KCX"
              className={cn(
                "w-auto object-contain transition-[height] duration-300",
                shellVisible ? "h-[2.1rem]" : "h-[2.25rem]"
              )}
            />
            <span className="leading-none">
              <span
                className={cn(
                  "block font-semibold tracking-[-0.02em] transition-[font-size] duration-300",
                  shellVisible ? "text-[1.68rem]" : "text-[1.82rem]"
                )}
              >
                <span className={cn(contentTone === "light" ? "text-slate-800" : "text-white")}>KC</span>
                <span
                  className={cn(
                    "transition-colors",
                    contentTone === "light"
                      ? "text-[#3e8a76] [text-shadow:0_0_6px_rgba(62,138,118,0.18)]"
                      : "text-[#4fa58f] [text-shadow:0_0_10px_rgba(79,165,143,0.3)]"
                  )}
                >
                  X
                </span>
              </span>
              <span
                className={cn(
                  "mt-0.5 block font-semibold uppercase tracking-[0.18em] transition-[font-size] duration-300",
                  shellVisible ? "text-[9px]" : "text-[9.5px]",
                  contentTone === "light" ? "text-slate-500" : "text-white/70"
                )}
              >
                FinOps Platform
              </span>
            </span>
          </a>

          <nav
            className={cn(
              "hidden flex-1 items-center justify-center transition-[gap,transform] duration-300 lg:flex",
              shellVisible ? "translate-x-0" : "scale-[1.01]",
              shellVisible ? "gap-1" : "gap-2"
            )}
            aria-label="Main navigation"
          >
            {NAV_MENUS.map((menu) => (
              <NavItem
                key={menu.key}
                label={menu.label}
                active={openMenuKey === menu.key}
                shellTone={contentTone}
                onClick={() => toggleMenuByClick(menu.key)}
                onMouseEnter={() => openMenu(menu.key)}
                onMouseLeave={scheduleCloseMenu}
              />
            ))}
          </nav>

          <div
            className={cn(
              "hidden items-center justify-end transition-[gap,transform] duration-300 lg:flex lg:min-w-[18rem]",
              shellVisible ? "gap-2" : "gap-2.5"
            )}
          >
            <Button
              variant="outline"
              className={cn(
                contentTone === "light"
                  ? "border-[rgba(21,37,49,0.16)] bg-white text-slate-700 hover:bg-slate-50"
                  : "border-[rgba(226,240,236,0.28)] bg-[rgba(255,255,255,0.05)] text-[#e9f4f0] hover:bg-[rgba(255,255,255,0.12)]"
              )}
              asChild
            >
              <a href="/" onClick={(event) => handleAppLinkClick(event, "/", handleNavClose)}>
                Login
              </a>
            </Button>

            <Button
              className={cn(
                "inline-flex items-center gap-1.5",
                "bg-[#3e8a76] text-white shadow-none hover:bg-[#357563] hover:shadow-none"
              )}
              asChild
            >
              <a href="/" onClick={(event) => handleAppLinkClick(event, "/", handleNavClose)}>
                Schedule a Demo
              </a>
            </Button>
          </div>

          <div className="lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-10 w-10 p-0",
                contentTone === "light"
                  ? "border-[rgba(21,37,49,0.16)] bg-white text-slate-900 hover:bg-slate-100"
                  : "border-[rgba(226,240,236,0.28)] bg-[rgba(255,255,255,0.05)] text-white hover:bg-[rgba(255,255,255,0.12)]"
              )}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <MegaMenu
            menu={activeMenu}
            open={Boolean(activeMenu)}
            shellTone="dark"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleCloseMenu}
            onLinkClick={handleNavClose}
          />
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-40 hidden transition-opacity duration-200 lg:block",
          contentTone === "light" ? "bg-[rgba(3,10,16,0.35)]" : "bg-[rgba(1,7,13,0.52)]",
          openMenuKey ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/45 transition-opacity lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={handleMobileClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[420px] border-l border-border-light bg-white p-6 shadow-xl transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Navigation</p>
          <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleMobileClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="mt-6">
          <Accordion type="single" collapsible>
            {NAV_MENUS.map((menu) => (
              <AccordionItem key={menu.key} value={menu.key}>
                <AccordionTrigger>{menu.label}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {menu.groups.map((group) => (
                      <div key={group.title}>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                          {group.title}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {group.links.map((link) => (
                            <a
                              key={link.title}
                              href={link.href}
                              className="block rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-highlight-green/60 hover:text-text-primary"
                              onClick={(event) => handleAppLinkClick(event, link.href, handleMobileClose)}
                            >
                              {link.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-6 space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="/" onClick={(event) => handleAppLinkClick(event, "/", handleMobileClose)}>
                Login
              </a>
            </Button>
            <Button className="w-full justify-start bg-[#3e8a76] text-white hover:bg-[#357563]" asChild>
              <a href="/" onClick={(event) => handleAppLinkClick(event, "/", handleMobileClose)}>
                Schedule a Demo
              </a>
            </Button>
          </div>
        </div>
      </aside>
    </header>
  )
}
