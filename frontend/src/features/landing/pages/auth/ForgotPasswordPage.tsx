import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { SplitHeroLeftPanel } from "@/features/landing/components/SplitHeroLeftPanel"
import { ForgotPasswordForm } from "@/features/landing/pages/auth/components/ForgotPasswordForm"

export function ForgotPasswordPage() {
  return (
    <section className="w-full min-h-[100svh] lg:h-[100svh] lg:overflow-hidden">
      <div className="grid min-h-[100svh] lg:h-[100svh] lg:grid-cols-[3fr_2fr]">
        <SplitHeroLeftPanel className="px-6 py-12 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[40rem]">
            <div className="flex items-center gap-3">
              <img src={kcxLogo} alt="KCX" className="h-8 w-auto" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(214,230,226,0.75)]">
                Password reset
              </span>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(170,225,207,0.88)]">
              Secure access
            </p>
            <h1 className="kcx-heading mt-3 text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[2.35rem]">
              Get a reset link.
            </h1>
            <p className="mt-4 max-w-[58ch] text-sm leading-7 text-[rgba(214,230,226,0.78)]">
              We’ll email you a secure link to set a new password.
            </p>
          </div>
        </SplitHeroLeftPanel>

        <main className="flex items-center bg-[#f6faf8] px-6 py-12 text-[#0F1F1A] sm:px-10 lg:h-[100svh] lg:overflow-auto lg:px-12 lg:py-0">
          <div className="mx-auto w-full max-w-[30rem]">
            <ForgotPasswordForm />
          </div>
        </main>
      </div>
    </section>
  )
}

