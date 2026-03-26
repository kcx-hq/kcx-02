export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="hero-aurora-base absolute inset-0 z-0" />
      <div className="hero-aurora-left-shade absolute inset-y-0 left-0 z-[1] w-[62%]" />

      <div className="hero-aurora-slate-wash absolute inset-0 z-[2] opacity-[0.78]" />
      <div className="hero-aurora-right-glow-a hero-aurora-glow absolute inset-y-[-8%] right-[-8%] z-[2] w-[68%] blur-3xl motion-reduce:animate-none" />
      <div className="hero-aurora-green-wash absolute inset-0 z-[2] opacity-[0.72]" />
      <div className="hero-aurora-right-glow-b hero-aurora-glow absolute inset-y-[-14%] right-[-12%] z-[2] w-[60%] blur-3xl [animation-delay:-7s] motion-reduce:animate-none" />
      <div className="hero-aurora-right-glow-c hero-aurora-glow absolute bottom-[-18rem] right-[6%] z-[2] h-[32rem] w-[36rem] blur-[120px] [animation-delay:-12s] motion-reduce:animate-none" />
      <div className="hero-aurora-prism hero-aurora-glow absolute inset-y-[-8%] right-[-9%] z-[2] w-[72%] opacity-[0.62] [animation-delay:-5s] motion-reduce:animate-none" />

      <div className="hero-aurora-grid absolute inset-0 z-[3] opacity-[0.18]" />
      <div className="hero-aurora-noise absolute inset-0 z-[4] opacity-[0.22]" />
    </div>
  )
}
