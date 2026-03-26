import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  HeartPulse,
  Layers3,
  MapPin,
  Search,
  ShieldCheck,
  TrendingUp,
  Users2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import { AuroraBackground } from "@/components/brand/AuroraBackground";
import { PageFooter } from "@/components/layout/PageFooter";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

type BenefitGroup = {
  title: "Growth" | "Health" | "Flexibility";
  eyebrow: string;
  icon: IconType;
  items: string[];
};

type Role = {
  title: string;
  department: string;
  location: string;
  employmentType: string;
  summary: string;
  team: string;
  applyHref: string;
  tags: string[];
};

export const careersDesignSystem = {
  spacing: {
    gridBase: 8,
    containerX: { mobile: 24, desktop: 40 },
    sectionY: { mobile: 72, desktop: 96 },
    stack: { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, "2xl": 40, "3xl": 56 },
  },
  typography: {
    display: { mobile: 56, desktop: 72, weight: 600, lineHeight: 0.98 },
    h1: { mobile: 36, desktop: 52, weight: 600, lineHeight: 1.02 },
    h2: { mobile: 38, desktop: 54, weight: 600, lineHeight: 1.04 },
    h3: { mobile: 20, desktop: 22, weight: 600, lineHeight: 1.18 },
    bodyLg: { mobile: 16, desktop: 18, weight: 400, lineHeight: 1.7 },
    body: { mobile: 14, desktop: 16, weight: 400, lineHeight: 1.7 },
    label: {
      mobile: 11,
      desktop: 11,
      weight: 600,
      lineHeight: 1.2,
      tracking: "0.2em",
    },
  },
  colors: {
    primary: "#63d1af",
    primaryHover: "#4ebb9a",
    neutral900: "#07111c",
    neutral800: "#102032",
    neutral600: "#6e857d",
    neutral300: "#d9e7e1",
    neutral100: "#f7faf8",
    white: "#ffffff",
    success: "#2f7f68",
    accentBlue: "#7eb6ff",
  },
  radius: { sm: 12, md: 16, lg: 24 },
  elevation: {
    card: "0 18px 38px rgba(7,17,28,0.08)",
    hero: "0 36px 80px rgba(6,16,26,0.42)",
  },
  motion: { fast: "150ms", default: "200ms", slow: "250ms" },
  breakpoints: { mobile: "<768", tablet: "768-1023", desktop: ">=1024" },
} as const;

export const careersComponentSpecs = {
  buttons: {
    primary:
      "44px min height, 20px horizontal padding, filled brand surface, visible focus ring, icon gap 6px",
    secondary:
      "44px min height, subtle border, white background, text-primary, hover tint and border shift",
    ghost:
      "44px min height, translucent surface on dark backgrounds, strong contrast on focus",
  },
  cards: {
    feature:
      "16px radius, 20px padding, 1px neutral border, soft card shadow, hover border emphasis",
    jobListing:
      "single divided surface, 20px row padding mobile / 24px desktop, inline metadata, right-aligned CTA",
  },
  fields: {
    input:
      "40-44px control height, 12px x padding, 16px radius, 1px neutral border, focus ring 2px",
    select:
      "same dimensions as text input, clear label above field, no dense chrome",
  },
  navigation: {
    layout:
      "max-w-6xl container, clear action separation, preserve 44px target size on all menu actions",
    states: "default, hover, focus-visible, expanded for dropdown triggers",
  },
  sections: {
    layout:
      "max-w-6xl container, 64px mobile / 80px desktop section rhythm, 24px header-to-grid spacing",
    content:
      "headings max 14-16 words, supporting copy max 60-68ch where possible",
  },
} as const;

const PAGE_CONTAINER = "mx-auto w-full max-w-6xl px-6 md:px-10";

const careersUi = {
  buttonBase:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  buttonPrimary:
    "border border-[rgba(163,247,221,0.65)] bg-[linear-gradient(135deg,rgba(95,199,168,0.92)_0%,rgba(74,167,143,0.92)_100%)] px-5 py-3 text-[#06111b] shadow-[0_10px_30px_rgba(72,169,145,0.28),inset_0_1px_0_rgba(255,255,255,0.22)] hover:-translate-y-0.5 hover:border-[rgba(189,255,233,0.84)] hover:shadow-[0_16px_40px_rgba(72,169,145,0.34)]",
  buttonSecondary:
    "border border-[rgba(148,169,161,0.3)] bg-white/92 px-5 py-3 text-text-primary shadow-[0_10px_24px_rgba(11,24,21,0.06)] hover:-translate-y-0.5 hover:border-[rgba(62,138,118,0.36)] hover:bg-white hover:text-[#2f7f68]",
  buttonGhost:
    "border border-white/20 bg-white/8 px-5 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/12",
  featureCard:
    "group relative overflow-hidden rounded-[28px] border border-[rgba(148,169,161,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(244,249,247,0.98)_100%)] p-6 shadow-[0_16px_34px_rgba(7,17,28,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(62,138,118,0.34)] hover:shadow-[0_22px_46px_rgba(7,17,28,0.12)] md:p-7",
  sectionIntro: "flex flex-col gap-4 md:max-w-3xl",
  sectionShell:
    "relative overflow-hidden rounded-[32px] border border-[rgba(147,169,160,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86)_0%,rgba(246,250,248,0.96)_100%)] px-6 py-8 shadow-[0_20px_42px_rgba(7,17,28,0.06)] md:px-8 md:py-10",
  fieldLabel:
    "mb-2.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5a716a]",
  input:
    "h-12 w-full rounded-2xl border border-[rgba(148,169,161,0.22)] bg-white/92 px-4 text-sm text-text-primary outline-none transition duration-200 focus:border-[rgba(62,138,118,0.34)] focus-visible:ring-2 focus-visible:ring-primary/40",
  inputShell:
    "flex h-12 w-full items-center gap-2 rounded-2xl border border-[rgba(148,169,161,0.22)] bg-white/92 px-4 text-sm text-text-primary transition duration-200 focus-within:border-[rgba(62,138,118,0.34)] focus-within:ring-2 focus-within:ring-primary/40",
  roleMeta:
    "mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary",
  pill: "rounded-full border border-[rgba(148,169,161,0.22)] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8f6_100%)] px-3 py-1.5 text-xs font-medium text-text-secondary",
  roleList:
    "mt-8 rounded-[30px] border border-[rgba(148,169,161,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(247,250,249,0.96)_100%)] p-2 shadow-[0_22px_44px_rgba(7,17,28,0.08)]",
  roleRow:
    "group relative overflow-hidden rounded-[24px] px-4 py-5 transition duration-200 hover:bg-[linear-gradient(180deg,rgba(247,251,249,0.98)_0%,rgba(241,248,245,0.98)_100%)] hover:shadow-[inset_0_0_0_1px_rgba(99,209,175,0.18)] md:px-6 md:py-6",
} as const;

const VALUES = [
  {
    icon: Layers3,
    title: "Clarity over complexity",
    description: "Make the decision path visible before adding more tooling.",
  },
  {
    icon: ShieldCheck,
    title: "Ownership by design",
    description:
      "Assign accountability early, where decisions and tradeoffs are made.",
  },
  {
    icon: Users,
    title: "Built for collaboration",
    description:
      "Finance, engineering, and leadership work from shared context.",
  },
  {
    icon: TrendingUp,
    title: "Measured improvement",
    description:
      "Progress is continuous, observable, and tied to operating outcomes.",
  },
];

const BENEFIT_GROUPS: BenefitGroup[] = [
  {
    title: "Growth",
    eyebrow: "Built for long-term growth",
    icon: TrendingUp,
    items: [
      "$2,500 annual learning budget",
      "Quarterly growth reviews with clear scope and progression",
      "Mentorship from experienced product, engineering, and FinOps leaders",
    ],
  },
  {
    title: "Health",
    eyebrow: "Coverage and recovery that matter",
    icon: HeartPulse,
    items: [
      "Medical, dental, and vision coverage where available",
      "Mental health support and company recharge days",
      "$800 home-office and ergonomics stipend",
    ],
  },
  {
    title: "Flexibility",
    eyebrow: "Remote-first, with clear operating rhythm",
    icon: MapPin,
    items: [
      "Flexible hours with core collaboration overlap",
      "Quarterly offsites for planning and team time",
      "Minimum 15 days PTO plus protected focus time",
    ],
  },
];
const OPEN_ROLES: Role[] = [
  {
    title: "Senior Frontend Engineer",
    department: "Engineering",
    location: "Remote (US)",
    employmentType: "Full-time",
    summary:
      "Own the product surface where finance, engineering, and leadership interpret the same cloud cost story differently and still need to act fast.",
    team: "Product Engineering",
    applyHref: "#",
    tags: ["React", "TypeScript", "Design Systems"],
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote (Europe)",
    employmentType: "Full-time",
    summary:
      "Design workflows that make cost allocation, anomaly investigation, and executive reporting feel precise instead of intimidating.",
    team: "Core Product",
    applyHref: "#",
    tags: ["B2B SaaS", "Systems Thinking", "Prototyping"],
  },
  {
    title: "FinOps Solutions Architect",
    department: "Customer",
    location: "Remote (US)",
    employmentType: "Full-time",
    summary:
      "Partner with enterprise customers to operationalize allocation, forecasting, and governance models that actually hold up in the real world.",
    team: "Customer Outcomes",
    applyHref: "#",
    tags: ["FinOps", "Cloud Economics", "Enterprise"],
  },
  {
    title: "Senior Data Engineer",
    department: "Engineering",
    location: "Bengaluru, India",
    employmentType: "Full-time",
    summary:
      "Build reliable ingestion and modeling pipelines for high-volume usage, billing, and allocation data across AWS, Azure, and GCP.",
    team: "Platform",
    applyHref: "#",
    tags: ["Python", "Data Pipelines", "Multi-cloud"],
  },
  {
    title: "Technical Recruiter",
    department: "People",
    location: "Remote (Global)",
    employmentType: "Contract",
    summary:
      "Help us close exceptional engineers, designers, and FinOps operators with a candidate experience that feels sharp, human, and respectful.",
    team: "Talent",
    applyHref: "#",
    tags: ["Hiring", "SaaS", "Candidate Experience"],
  },
];

function IconDot({ icon: Icon }: { icon: IconType }) {
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(99,209,175,0.28)] bg-[linear-gradient(180deg,rgba(233,248,242,0.96)_0%,rgba(223,242,235,0.96)_100%)] text-[#2f7f68] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  );
}

function CareersButton({
  href,
  variant,
  children,
  className,
}: {
  href: string;
  variant: "primary" | "secondary" | "ghost";
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        careersUi.buttonBase,
        variant === "primary" && careersUi.buttonPrimary,
        variant === "secondary" && careersUi.buttonSecondary,
        variant === "ghost" && careersUi.buttonGhost,
        className,
      )}
    >
      {children}
    </a>
  );
}

function CareersHero() {
  return (
    <section
      data-header-theme="dark"
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#06101a] pb-18 pt-24 text-white md:pb-24 md:pt-28"
    >
      <div className="absolute inset-0 opacity-70">
        <AuroraBackground />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,18,0.82)_0%,rgba(7,14,20,0.76)_48%,rgba(8,16,23,0.94)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_48%_at_78%_18%,rgba(102,210,179,0.16),transparent_72%),radial-gradient(42%_32%_at_14%_20%,rgba(89,144,224,0.16),transparent_72%),radial-gradient(34%_30%_at_52%_58%,rgba(77,157,136,0.12),transparent_78%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:68px_68px]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(6,12,18,0)_0%,rgba(6,12,18,0.65)_100%)]" />

      <div className={cn(PAGE_CONTAINER, "relative z-10")}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(151,228,203,0.92)]">
              Company / Careers
            </p>

            {/* ✅ Updated Headline */}
            <h1
              className="
                mt-5 max-w-4xl text-balance font-semibold text-white
                tracking-[-0.035em]
                text-[2.2rem] leading-[1.05]
                sm:text-[2.6rem]
                md:text-[3.2rem] md:leading-[1.02]
                lg:text-[3.6rem]
              "
            >
              Build the system that powers cloud cost decisions
            </h1>

            {/* ✅ Updated Subtitle */}
            <p
              className="
                mt-5 max-w-2xl
                text-[0.98rem] leading-7
                text-[rgba(214,230,226,0.78)]
                md:text-[1.05rem]
              "
            >
              KCX helps finance and engineering teams make better cloud
              decisions before costs become surprises. Join a product-driven
              team solving allocation, accountability, and optimization problems
              with real business stakes.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <CareersButton
                href="#open-roles"
                variant="primary"
                className="focus-visible:ring-offset-[#06101a]"
              >
                View Open Roles
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </CareersButton>

              <CareersButton
                href="#talent-network"
                variant="ghost"
                className="focus-visible:ring-offset-[#06101a]"
              >
                Join Talent Network
              </CareersButton>
            </div>
          </div>

      
        </div>
      </div>
    </section>
  );
}

function StickyCareersBar() {
  return (
    <div className="sticky bottom-0 z-30 border-t border-[rgba(16,30,43,0.08)] bg-[rgba(249,251,250,0.92)] px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[rgba(249,251,250,0.78)] md:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
        <CareersButton
          href="#open-roles"
          variant="secondary"
          className="min-w-0 flex-1 rounded-md px-4 py-3"
        >
          View Open Roles
        </CareersButton>
        <CareersButton
          href="#talent-network"
          variant="secondary"
          className="min-w-0 flex-1 rounded-md px-4 py-3"
        >
          Join Talent Network
        </CareersButton>
      </div>
    </div>
  );
}
function ValuesSection() {
  return (
    <section aria-labelledby="values-title" className="py-12 md:py-16">
      <div className={PAGE_CONTAINER}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2f7f68]">
            How we build
          </p>

          <h2
            id="values-title"
            className="mt-3 text-[1.9rem] font-semibold tracking-[-0.045em] text-text-primary sm:text-[2.2rem] md:text-[2.7rem]"
          >
            Values that shape how we build
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-[0.98rem] leading-7 text-text-secondary md:text-[1rem]">
            We keep teams close to decisions, reduce unnecessary complexity, and
            build systems that improve with use.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2">
          {VALUES.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="
                  group relative overflow-hidden rounded-[24px]
                  border border-[#d9e7e1] bg-white/85
                  p-5 shadow-[0_10px_28px_rgba(12,24,20,0.05)]
                  transition duration-200
                  hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(12,24,20,0.08)]
                  md:p-6
                "
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,rgba(72,163,136,0.92),rgba(125,214,187,0.55),rgba(72,163,136,0.18))]" />

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_100%_0%,rgba(117,212,184,0.06),transparent_55%)] opacity-0 transition duration-300 group-hover:opacity-100" />

                <div className="relative flex items-start gap-4">
                  <div
                    className="
                      flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]
                      border border-[#cfe1d9] bg-[#eef6f2]
                      text-[#2f7f68]
                    "
                  >
                    <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-[1.3rem] font-semibold tracking-[-0.03em] text-text-primary">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-[0.96rem] leading-7 text-text-secondary">
                      {item.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section
      aria-labelledby="benefits-title"
      className="py-14 md:py-18 bg-[#07141c] text-white"
    >
      <div className={PAGE_CONTAINER}>
        {/* ✅ Header */}
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(160,229,206,0.9)]">
            Benefits
          </p>

          <h2
            id="benefits-title"
            className="mt-3 text-[2rem] font-semibold tracking-[-0.035em] text-white md:text-[2.6rem]"
          >
            Thoughtful support, not perk theater
          </h2>

          <p className="mt-3 text-[0.98rem] leading-7 text-[rgba(219,233,229,0.75)]">
            The essentials are strong, practical, and designed to support
            focused work over the long term.
          </p>
        </div>

        {/* ✅ Cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {BENEFIT_GROUPS.map((group) => {
            const Icon = group.icon;

            return (
              <article
                key={group.title}
                className="
                  group rounded-[22px]
                  border border-white/10
                  bg-white/[0.04]
                  p-5
                  transition duration-200
                  hover:border-[rgba(122,221,191,0.25)]
                  hover:bg-white/[0.06]
                "
              >
                {/* Top */}
                <div className="flex items-center gap-3">
                  <IconDot icon={Icon} />

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(160,229,206,0.85)]">
                      {group.eyebrow}
                    </p>

                    <h3 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.02em] text-white">
                      {group.title}
                    </h3>
                  </div>
                </div>

                {/* List */}
                <ul className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[0.9rem] leading-6 text-[rgba(219,233,229,0.78)]"
                    >
                      <CheckCircle2
                        className="mt-[2px] h-4 w-4 shrink-0 text-[#79dcbf]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OpenRolesSection() {
  const [department, setDepartment] = useState("All departments");
  const [location, setLocation] = useState("All locations");
  const [query, setQuery] = useState("");

  const departments = useMemo(
    () => [
      "All departments",
      ...new Set(OPEN_ROLES.map((role) => role.department)),
    ],
    [],
  );
  const locations = useMemo(
    () => [
      "All locations",
      ...new Set(OPEN_ROLES.map((role) => role.location)),
    ],
    [],
  );

  const filteredRoles = useMemo(() => {
    const searchTerm = query.trim().toLowerCase();

    return OPEN_ROLES.filter((role) => {
      const matchesDepartment =
        department === "All departments" || role.department === department;
      const matchesLocation =
        location === "All locations" || role.location === location;

      if (!searchTerm) {
        return matchesDepartment && matchesLocation;
      }

      const haystack = [
        role.title,
        role.summary,
        role.department,
        role.location,
        role.team,
        role.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesDepartment && matchesLocation && haystack.includes(searchTerm)
      );
    });
  }, [department, location, query]);

  return (
    <section
      id="open-roles"
      aria-labelledby="open-roles-title"
      className="py-14 md:py-16"
    >
      <div className={PAGE_CONTAINER}>
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(54%_44%_at_0%_0%,rgba(126,182,255,0.05),transparent_72%),radial-gradient(34%_32%_at_100%_0%,rgba(99,209,175,0.06),transparent_72%)]" />

          <div className="relative">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2f7f68]">
                Open roles
              </p>

              <h2
                id="open-roles-title"
                className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-text-primary md:text-[2.45rem]"
              >
                Open roles at KCX
              </h2>

              <p className="mx-auto mt-3 max-w-2xl text-[0.96rem] leading-7 text-text-secondary">
                Filter by team or location, then apply to the role that best
                matches your strengths.
              </p>

              <div className="mx-auto mt-5 h-px w-16 bg-gradient-to-r from-transparent via-[#86cdb5] to-transparent opacity-70" />
            </div>

            <div className="mt-6 grid gap-3 rounded-[18px] border border-[rgba(148,169,161,0.16)] bg-white/72 p-3.5 shadow-[0_10px_30px_rgba(12,24,20,0.04)] backdrop-blur-sm md:grid-cols-[170px_1fr_1fr_1.2fr] md:items-center">
              <div className="rounded-[14px] border border-[rgba(148,169,161,0.16)] bg-white px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5d746c]">
                  Current openings
                </p>
                <p className="mt-1 text-[1rem] font-semibold leading-5 tracking-[-0.03em] text-text-primary">
                  {filteredRoles.length} roles
                  <br />
                  available
                </p>
              </div>

              <label className="text-sm text-text-secondary">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5d746c]">
                  Department
                </span>
                <select
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="h-10 w-full rounded-[12px] border border-[rgba(148,169,161,0.16)] bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[rgba(99,209,175,0.45)]"
                >
                  {departments.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5d746c]">
                  Location
                </span>
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="h-10 w-full rounded-[12px] border border-[rgba(148,169,161,0.16)] bg-white px-3 text-sm text-text-primary outline-none transition focus:border-[rgba(99,209,175,0.45)]"
                >
                  {locations.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5d746c]">
                  Search
                </span>
                <div className="flex h-10 items-center gap-2 rounded-[12px] border border-[rgba(148,169,161,0.16)] bg-white px-3 transition focus-within:border-[rgba(99,209,175,0.45)]">
                  <Search
                    className="h-4 w-4 text-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    type="search"
                    placeholder="Role, team, or skill"
                    className="w-full border-0 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                </div>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {filteredRoles.map((role) => (
                <article
                  key={role.title}
                  className="group relative rounded-[20px] border border-[rgba(148,169,161,0.16)] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(12,24,20,0.04)] transition duration-200 hover:border-[rgba(99,209,175,0.24)] hover:shadow-[0_12px_28px_rgba(12,24,20,0.06)] md:px-6 md:py-5"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(99,209,175,0.34),transparent)] opacity-0 transition duration-200 group-hover:opacity-100" />

                  {/* Top row */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-text-primary md:text-[1.2rem]">
                          {role.title}
                        </h3>

                        <span className="inline-flex rounded-full border border-[rgba(99,209,175,0.2)] bg-[rgba(99,209,175,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2f7f68]">
                          {role.team}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <CareersButton
                        href={role.applyHref}
                        variant="secondary"
                        className="h-9 min-w-[7.25rem] px-4"
                      >
                        Apply
                        <ArrowRight
                          className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </CareersButton>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="mt-3 max-w-4xl text-[0.94rem] leading-7 text-text-secondary">
                    {role.summary}
                  </p>

                  {/* Meta */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {role.department}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {role.location}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                      {role.employmentType}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {role.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[rgba(148,169,161,0.14)] bg-[rgba(247,250,249,0.92)] px-2.5 py-1 text-[10.5px] text-text-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}

              {filteredRoles.length === 0 ? (
                <article className="rounded-[20px] border border-[rgba(148,169,161,0.16)] bg-white/70 px-5 py-8 text-center shadow-[0_10px_24px_rgba(12,24,20,0.04)]">
                  <p className="text-lg font-semibold text-text-primary">
                    No roles match your filters
                  </p>
                  <p className="mt-1.5 text-base text-text-secondary">
                    Try widening your search or join the talent network so we
                    can reach out when the right role opens.
                  </p>
                </article>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function FinalCtaSection() {
  return (
    <section
      id="talent-network"
      aria-labelledby="careers-cta-title"
      className="pb-24 pt-[72px] md:pb-28 md:pt-24"
    >
      <div className={PAGE_CONTAINER}>
        <div className="relative overflow-hidden rounded-[36px] border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(136deg,#07131f_0%,#0d2131_48%,#112639_100%)] p-7 text-white shadow-[0_36px_90px_rgba(8,16,27,0.38)] md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(56%_74%_at_84%_20%,rgba(102,210,179,0.18),transparent_74%),radial-gradient(44%_58%_at_12%_88%,rgba(75,128,210,0.16),transparent_74%),linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_100%)]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(180,246,225,0.7),transparent)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(158,224,201,0.94)]">
                Join talent network
              </p>
              <h2
                id="careers-cta-title"
                className="mt-4 max-w-3xl text-balance text-[2.4rem] font-semibold tracking-[-0.04em] md:text-[3.5rem] md:leading-[1.02]"
              >
                If the right role is not open yet, we should still talk
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[rgba(217,233,229,0.88)] md:text-lg md:leading-8">
                We regularly hire across engineering, design, data, and FinOps.
                Introduce yourself and we will keep in touch.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <CareersButton
                href="#open-roles"
                variant="ghost"
                className="focus-visible:ring-offset-[#0a1724]"
              >
                View Open Roles
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </CareersButton>
              <CareersButton
                href="#"
                variant="primary"
                className="border-0 bg-[linear-gradient(135deg,#72ddbf_0%,#54c3a2_100%)] px-5 py-3 text-[#08111c] shadow-[0_16px_40px_rgba(84,195,162,0.28)] hover:bg-[linear-gradient(135deg,#80e4c7_0%,#5cccab_100%)] focus-visible:ring-offset-[#0a1724]"
              >
                Join Talent Network
                <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
              </CareersButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CareersPage() {
  return (
    <>
      <CareersHero />

      <main
        data-header-theme="light"
        className="bg-[linear-gradient(180deg,#eef3f1_0%,#f8fbfa_32%,#eef5f2_100%)]"
      >
        <ValuesSection />
        <BenefitsSection />
        <OpenRolesSection />
        <FinalCtaSection />
      </main>

      <StickyCareersBar />
      <PageFooter />
    </>
  );
}
