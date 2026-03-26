"use client"

import { useMemo, useRef, useState } from "react"
import {
  motion,
  useReducedMotion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  MotionValue,
} from "framer-motion"

// --- Configuration & Design System ---

type StepConfig = {
  id: string
  title: string
  subtitle: string
  bullets: [string, string, string]
  imageSide: "left" | "right"
  insightLabel: string
  cssThemeClass: string 
  tone: { border: string; glow: string; activeIndicator: string }
}

const KCX_STEPS: StepConfig[] = [
  {
    id: "connect",
    title: "Connect your cloud",
    subtitle: "Securely aggregate AWS, Azure, and GCP into a single intelligent control layer without agents.",
    bullets: ["Multi-cloud API ingestion", "Read-only IAM role security", "Instant asset discovery"],
    imageSide: "right",
    insightLabel: "Data Ingestion",
    cssThemeClass: "kcx-premium-card--teal",
    tone: { border: "rgba(62,138,118,0.42)", glow: "rgba(62,138,118,0.18)", activeIndicator: "#3e8a76" },
  },
  {
    id: "visibility",
    title: "Gain full visibility",
    subtitle: "Map raw billing metadata to real business units, engineering teams, and product features.",
    bullets: ["Automated tag compliance", "Shared resource splitting", "Unit economics dashboard"],
    imageSide: "left",
    insightLabel: "Cost Allocation",
    cssThemeClass: "kcx-premium-card--blue",
    tone: { border: "rgba(56,189,248,0.38)", glow: "rgba(56,189,248,0.16)", activeIndicator: "#38bdf8" },
  },
  {
    id: "anomaly",
    title: "Detect anomalies",
    subtitle: "Identify cost spikes in real-time before they impact your end-of-month burn rate.",
    bullets: ["ML baseline forecasting", "Slack & Teams alerting", "Drill-down root cause analysis"],
    imageSide: "right",
    insightLabel: "Risk Management",
    cssThemeClass: "kcx-premium-card--rose",
    tone: { border: "rgba(244,63,94,0.38)", glow: "rgba(244,63,94,0.16)", activeIndicator: "#f43f5e" },
  },
  {
    id: "savings",
    title: "Unlock savings",
    subtitle: "One-click recommendations to right-size instances, upgrade plans, and delete idle waste.",
    bullets: ["Reserved Instance planning", "Orphaned volume cleanup", "Compute rightsizing logic"],
    imageSide: "left",
    insightLabel: "Optimization",
    cssThemeClass: "kcx-premium-card--emerald",
    tone: { border: "rgba(16,185,129,0.38)", glow: "rgba(16,185,129,0.16)", activeIndicator: "#10b981" },
  },
]

const ANOMALY_LOG_LINES = [
  "KCX-AGENT: Monitoring rds-prod-01 baseline drift...",
  "KCX-AGENT: Checking read-iops anomaly confidence...",
  "KCX-AGENT: Correlating spend variance with workload spikes...",
  "KCX-AGENT: Root-cause trace initiated for cluster alpha...",
  "KCX-AGENT: Alert routed to platform-oncall workflow...",
]

// --- Premium Visual Components ---

function MockUIConnect({ tone }: { tone: StepConfig["tone"] }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Animated Grid Background */}
      <motion.div 
        className="absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px]"
        animate={{ backgroundPosition: ["0px 0px", "30px 30px"] }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
      />
      
      <div className="relative z-10 flex w-full max-w-[280px] sm:max-w-sm items-center justify-between">
        {/* Cloud Sources */}
        <div className="flex flex-col gap-5 sm:gap-8 w-24 sm:w-32 z-20">
          {["AWS", "AZURE", "GCP"].map((cloud, i) => (
            <div key={cloud} className="relative flex items-center justify-end">
              <motion.div 
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 + 0.2 }}
                className="relative z-10 flex h-10 sm:h-12 w-full items-center justify-between px-3 sm:px-4 rounded-xl border border-white/10 bg-gradient-to-br from-slate-800/90 to-slate-900/90 shadow-lg backdrop-blur-md"
              >
                <span className="text-[10px] sm:text-xs font-bold tracking-widest text-slate-300">{cloud}</span>
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.activeIndicator, boxShadow: `0 0 10px ${tone.activeIndicator}` }} />
              </motion.div>
              
              {/* Data Flow Lines */}
              <svg className="absolute left-full w-20 sm:w-28 h-2 overflow-visible z-0" preserveAspectRatio="none">
                <motion.line 
                  x1="0" y1="4" x2="100%" y2="4" 
                  stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4"
                />
                {/* Flowing Data Packets */}
                <motion.circle 
                  cx="0" cy="4" r="2" fill={tone.activeIndicator}
                  style={{ filter: `drop-shadow(0 0 4px ${tone.activeIndicator})` }}
                  animate={{ cx: ["0%", "100%"], opacity: [0, 1, 0] }} 
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.4, ease: "linear" }}
                />
                <motion.circle 
                  cx="0" cy="4" r="1.5" fill="#fff"
                  animate={{ cx: ["0%", "100%"], opacity: [0, 1, 0] }} 
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.4 + 0.75, ease: "linear" }}
                />
              </svg>
            </div>
          ))}
        </div>

        {/* Central Hub Engine */}
        <div className="relative flex items-center justify-center">
          {/* Rotating Data Rings */}
          <motion.div 
            className="absolute h-32 w-32 sm:h-44 sm:w-44 rounded-full border border-dashed border-white/20"
            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          />
          <motion.div 
            className="absolute h-24 w-24 sm:h-32 sm:w-32 rounded-full border-t border-r"
            style={{ borderColor: tone.activeIndicator, filter: `drop-shadow(0 0 8px ${tone.activeIndicator})` }}
            animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
          />
          
          <motion.div 
            className="relative z-10 flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-slate-800 to-slate-950 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            initial={{ scale: 0.8, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.4 }}
          >
            <div className="absolute inset-0 rounded-2xl animate-pulse opacity-30" style={{ backgroundColor: tone.glow }} />
            <motion.div 
              className="absolute inset-0 rounded-2xl border-2" style={{ borderColor: tone.activeIndicator }}
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2 }}
            />
            <div className="mb-1 rounded p-1.5" style={{ backgroundColor: `${tone.activeIndicator}20` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tone.activeIndicator} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            </div>
            <span className="text-lg sm:text-xl font-black tracking-widest text-white drop-shadow-md">KCX</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function MockUIVisibility({ tone }: { tone: StepConfig["tone"] }) {
  return (
    <div className="relative flex h-full w-full flex-col p-3 sm:p-8">
      {/* Floating Header Widget */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="flex items-center justify-between z-20 bg-slate-800/50 border border-white/5 rounded-xl p-2.5 sm:p-4 backdrop-blur-md shadow-lg"
      >
        <div>
          <div className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Total Allocated</div>
          <div className="text-lg sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            $142,850 
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono tracking-normal">+2.4%</span>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">Top Cost Center</div>
          <div className="text-sm font-bold text-white flex items-center justify-end gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tone.activeIndicator }} />
            Engineering Team
          </div>
        </div>
      </motion.div>
      
      {/* Complex Area Chart Visualization */}
      <div className="relative flex-1 mt-3 sm:mt-6 border-b border-l border-white/10 flex items-end">
        {/* Y/X Axis Grid */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none z-0">
          {[1,2,3,4].map(i => <div key={i} className="w-full border-b border-white" />)}
        </div>
        
        {/* Area Gradient */}
        <div className="absolute inset-0 z-10 overflow-hidden">
           <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
             <defs>
               <linearGradient id="vis-grad" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="0%" stopColor={tone.activeIndicator} stopOpacity="0.4" />
                 <stop offset="100%" stopColor={tone.activeIndicator} stopOpacity="0.0" />
               </linearGradient>
             </defs>
             <motion.path 
               d="M 0 100 L 0 60 C 20 40, 30 70, 50 30 C 70 -10, 80 40, 100 20 L 100 100 Z" 
               fill="url(#vis-grad)"
               initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}
             />
           </svg>
        </div>

        {/* Animated Line Path */}
        <div className="absolute inset-0 z-20">
           <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
             <motion.path 
               d="M 0 60 C 20 40, 30 70, 50 30 C 70 -10, 80 40, 100 20" 
               fill="none" stroke={tone.activeIndicator} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
               style={{ filter: `drop-shadow(0 4px 6px ${tone.glow})` }}
               initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
             />
             
             {/* Data Point Node */}
             <motion.circle
               cx="50" cy="30" r="4" fill="#0f172a" stroke={tone.activeIndicator} strokeWidth="2"
               initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} transition={{ delay: 1.5 }}
             />
           </svg>
        </div>

        {/* Floating Tooltip at the Data Point */}
        <motion.div 
          className="absolute z-30 bg-slate-900 border border-white/10 rounded-lg p-1.5 sm:p-2 shadow-2xl backdrop-blur-md left-1/2 top-1 -translate-x-1/2 sm:-top-4 sm:-translate-y-full"
          initial={{ opacity: 0, y: 10, scale: 0.9 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 1.6, type: "spring" }}
        >
          <div className="text-[9px] text-slate-400 mb-0.5">May 14 - Proj_Alpha</div>
          <div className="text-xs sm:text-sm font-bold text-white">$4,250.00</div>
          <div className="absolute -bottom-1.5 left-1/2 hidden -translate-x-1/2 w-3 h-3 bg-slate-900 border-b border-r border-white/10 rotate-45 sm:block" />
        </motion.div>
      </div>
    </div>
  )
}

function MockUIAnomaly({ tone }: { tone: StepConfig["tone"] }) {
  const telemetryLines = useMemo(
    () => Array.from({ length: 20 }, (_, i) => ANOMALY_LOG_LINES[i % ANOMALY_LOG_LINES.length]),
    [],
  )

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#05080c]">
      {/* Code Log Background (Faster, fading out near center) */}
      <div className="absolute inset-0 p-4 font-mono text-[8px] sm:text-[10px] text-slate-600/30 leading-relaxed overflow-hidden">
        {telemetryLines.map((line, i) => (
          <motion.div
            key={`${line}-${i}`}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ repeat: Infinity, duration: 2.2 + ((i % 5) * 0.35), delay: i * 0.08 }}
          >
            {line}
          </motion.div>
        ))}
        {/* Gradient mask to focus on center */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#05080c_82%)] z-10" />
      </div>

      <div className="relative z-20 flex h-full flex-col justify-center p-3 sm:p-6 gap-2 sm:gap-4">
        
        {/* Mock Slack/Teams Alert Banner Sliding In */}
        <motion.div 
          className="self-end max-w-[220px] sm:max-w-[240px] bg-slate-800/90 border border-white/10 rounded-xl p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl flex gap-2.5 sm:gap-3 items-start"
          initial={{ opacity: 0, x: 50, y: -20 }} whileInView={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 1.5, type: "spring" }}
        >
          <div className="w-6 h-6 rounded bg-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-300">KCX Alert Bot</div>
            <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">Unusual spike in <span className="text-rose-400 font-mono">rds-prod-01</span> detected. +340% above baseline.</div>
          </div>
        </motion.div>

        {/* The Spike Graph */}
        <motion.div 
          className="rounded-xl border border-white/10 bg-slate-900/60 p-2.5 sm:p-5 shadow-2xl backdrop-blur-md relative overflow-hidden"
          initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
        >
          {/* Flashing Red Background on Spike */}
          <motion.div 
            className="absolute inset-0 bg-rose-500/10 mix-blend-overlay"
            initial={{ opacity: 0 }} whileInView={{ opacity: [0, 1, 0, 1, 0.2] }} transition={{ delay: 1, duration: 2 }}
          />

          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
            <div className="text-xs sm:text-sm font-bold text-white tracking-wide">Read IOPS Utilization</div>
            <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              ANOMALY
            </div>
          </div>
          
          <div className="h-12 sm:h-16 w-full relative z-10">
             <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
              {/* Baseline Path */}
              <path d="M 0 80 L 100 80" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
              
              {/* Data Path */}
              <motion.path 
                d="M 0 75 L 15 78 L 30 72 L 40 76 L 45 74 L 50 10 L 55 40 L 60 75 L 75 78 L 90 73 L 100 75" 
                fill="none" stroke={tone.activeIndicator} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 6px ${tone.glow})` }}
                initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.6 }}
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function MockUISavings({ tone }: { tone: StepConfig["tone"] }) {
  return (
    <div className="flex h-full w-full flex-col justify-start p-2.5 sm:p-8 gap-2 sm:gap-4 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08),transparent_50%)]">
      
      {/* Hero Metric */}
      <motion.div 
        className="mb-1 sm:mb-2"
        initial={{ opacity: 0, y: -10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      >
        <div className="text-[9px] sm:text-[10px] font-bold tracking-widest text-slate-400 mb-1 uppercase">Potential Monthly Savings</div>
        <div className="text-lg sm:text-4xl font-black text-white flex items-center gap-2 sm:gap-3">
          $13,720
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tone.activeIndicator} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce sm:h-6 sm:w-6"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        </div>
      </motion.div>
      
      {/* Interactive-looking Action Cards */}
      <div className="flex flex-col gap-2 sm:gap-3 z-10">
        {[
          { t: "Downgrade Idle RDS", target: "db-analytics-02", save: "$800/mo" },
          { t: "Clean Orphaned Volumes", target: "4 EBS Volumes", save: "$120/mo" },
          { t: "Apply Reserved Instance", target: "c5.4xlarge x 8", save: "$3,200/mo" }
        ].map((action, i) => (
          <motion.div 
            key={i}
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-slate-800/60 p-2 sm:p-4 hover:bg-slate-700/60 transition-colors duration-300 backdrop-blur-md cursor-pointer flex items-center justify-between"
            initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 + 0.4 }}
          >
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="text-[11px] leading-4 sm:text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{action.t}</div>
              <div className="text-[9px] sm:text-[10px] font-mono text-slate-500 mt-0.5">{action.target}</div>
            </div>
            
            <div className="relative z-10 flex items-center gap-2 sm:gap-4">
              <span className="font-mono text-[11px] sm:text-sm font-bold" style={{ color: tone.activeIndicator }}>{action.save}</span>
              {/* Mock Action Button */}
              <div className="hidden sm:flex px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                APPLY
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// --- Main Stacking Card Component ---

function StackedCard({ step, index }: { step: StepConfig; index: number }) {
  const isLeft = step.imageSide === "left"
  const isSavingsStep = index === KCX_STEPS.length - 1
  const visualHeightClass = isSavingsStep
    ? "h-[228px] sm:h-[250px] lg:h-[360px]"
    : "h-[200px] sm:h-[250px] lg:h-[360px]"
  const visualScaleClass = isSavingsStep ? "scale-[0.95] sm:scale-100" : "scale-[0.92] sm:scale-100"

  return (
    <div 
      className="w-full sticky mb-8 sm:mb-12 lg:mb-[28vh]"
      style={{ 
        top: `calc(clamp(4.75rem,10vh,8rem) + ${index * 22}px)`,
        height: "max-content" 
      }}
    >
      <motion.div 
        className={`kcx-premium-card ${step.cssThemeClass} relative mx-auto w-full max-w-[70rem] overflow-hidden rounded-[18px] sm:rounded-[24px] border bg-[linear-gradient(180deg,rgba(15,23,34,0.96)_0%,rgba(9,14,20,0.98)_100%)] p-4 sm:p-7 lg:p-9 ring-1 ring-white/[0.04] backdrop-blur-2xl`}
        style={{ 
            borderColor: step.tone.border,
            scale: 1 - (index * 0.002)
        }}
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ margin: "-50px", once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-4 sm:mb-8 flex items-center gap-3 sm:gap-4 border-b border-white/5 pb-3 sm:pb-5 relative z-10">
          <span className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/5 text-[10px] sm:text-xs font-bold" style={{ color: step.tone.activeIndicator }}>0{index + 1}</span>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{step.insightLabel}</span>
        </div>

        <div className="grid gap-5 sm:gap-7 lg:grid-cols-[1.1fr_1fr] items-center relative z-10">
          
          <div className={`flex flex-col ${isLeft ? "lg:order-2" : "lg:order-1"}`}>
          <h3 className="mb-2.5 sm:mb-4 text-xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight text-balance">
              {step.title}
            </h3>
            <p className="mb-4 sm:mb-7 text-[13px] sm:text-base lg:text-lg text-slate-300/80 leading-relaxed max-w-lg text-balance">
              {step.subtitle}
            </p>
            
            <ul className="space-y-2.5 sm:space-y-4">
              {step.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 sm:gap-3 text-[13px] sm:text-base text-slate-200/90 font-medium">
                  <div className="mt-1.5 h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 rounded-full" style={{ backgroundColor: step.tone.activeIndicator, boxShadow: `0 0 12px ${step.tone.activeIndicator}` }} />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className={`relative ${visualHeightClass} w-full overflow-hidden rounded-[14px] sm:rounded-[20px] border border-white/10 bg-[#0b1118] shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] ${isLeft ? "lg:order-1" : "lg:order-2"}`}>
             <div className="absolute inset-0 opacity-20 blur-[60px] transition-colors duration-700 pointer-events-none" style={{ backgroundColor: step.tone.glow }} />
             
             <div className={`relative z-10 h-full w-full ${visualScaleClass}`}>
               {index === 0 && <MockUIConnect tone={step.tone} />}
               {index === 1 && <MockUIVisibility tone={step.tone} />}
               {index === 2 && <MockUIAnomaly tone={step.tone} />}
               {index === 3 && <MockUISavings tone={step.tone} />}
             </div>
          </div>

        </div>
      </motion.div>
    </div>
  )
}

// --- Smooth Flow Indicator ---
function FlowPathIndicator({ activeIndex, scrollYProgress, total, visible }: { activeIndex: number; scrollYProgress: MotionValue<number>; total: number; visible: boolean }) {
  const sectionOpacity = useTransform(scrollYProgress, [0.0, 0.05, 0.95, 1.0], [0, 1, 1, 0])
  const progressHeight = total > 1 ? (activeIndex / (total - 1)) * 100 : 0

  return (
    <motion.div 
      className="pointer-events-none fixed bottom-0 right-2 top-0 z-50 hidden w-[8px] sm:right-6 sm:w-[12px] md:right-10 lg:block"
      style={{ opacity: visible ? sectionOpacity : 0 }}
    >
      <div className="absolute top-1/2 -translate-y-1/2 h-[25vh] w-full flex justify-center">
        <div className="absolute inset-y-0 w-[2px] bg-slate-800/60 rounded-full" />
        <motion.div
          className="absolute top-0 w-[2px] bg-[#3e8a76] shadow-[0_0_12px_#3e8a76] rounded-full origin-top"
          animate={{ height: `${progressHeight}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
        <div className="absolute inset-y-0 w-full flex flex-col justify-between items-center">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="h-[6px] w-[6px] sm:h-[8px] sm:w-[8px] rounded-full relative z-10 transition-all duration-500"
              style={{ 
                backgroundColor: i <= activeIndex ? "#3e8a76" : "#1e293b",
                boxShadow: i <= activeIndex ? "0 0 12px #3e8a76" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function HowKcxWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showFlow, setShowFlow] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  useMotionValueEvent(scrollYProgress, "change", (val) => {
    const stepPercentage = 1 / KCX_STEPS.length
    const index = Math.min(Math.floor(val / stepPercentage), KCX_STEPS.length - 1)
    setActiveIndex((prev) => (prev === index ? prev : index))
    setShowFlow((prev) => {
      const next = !prefersReducedMotion && val > 0.02 && val < 0.98
      return prev === next ? prev : next
    })
  })

  return (
    <section 
      ref={containerRef}
      data-header-theme="light"
      className="relative w-full bg-[linear-gradient(180deg,#050b11_0%,#081520_50%,#081620_100%)] pb-12 sm:pb-16" 
    >
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(12,24,30,0.95),rgba(6,12,18,1))]" />
      </div>

      {!prefersReducedMotion ? (
        <FlowPathIndicator
          activeIndex={activeIndex}
          scrollYProgress={scrollYProgress}
          total={KCX_STEPS.length}
          visible={showFlow}
        />
      ) : null}

      <div className="relative z-10 w-full px-4 md:px-8 lg:px-10 max-w-[85rem] mx-auto">
        
        {/* === PERFECTED HEADING SECTION === */}
        <div className="w-full flex flex-col items-center text-center relative z-10 pt-16 sm:pt-24 pb-12 sm:pb-20 bg-transparent">
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(140,216,190,0.72)]"
          >
            Platform Workflow
          </motion.p>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-[1.85rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] font-semibold text-white tracking-tight"
          >
            How <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#3e8a76] to-emerald-400">KCX</span> Works
          </motion.h2>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: 0.2 }}
            className="mt-5 max-w-2xl text-[0.9rem] sm:text-[0.95rem] lg:text-base text-slate-400 leading-[1.7] text-balance px-4"
          >
            A seamless pipeline from raw cloud ingestion to actionable, unit-economic optimization. No agents required.
          </motion.p>
          
        </div>

        <div className="relative w-full pt-4">
          {KCX_STEPS.map((step, index) => (
            <StackedCard 
              key={step.id} 
              step={step} 
              index={index} 
            />
          ))}
          
          <div className="h-[15vh] w-full pointer-events-none" />
        </div>
      </div>
    </section>
  )
}
