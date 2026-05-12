export type OptimizationInsightKey = "rightsizing" | "idle-resources" | "commitments";

export type SavingInsight = {
  key: OptimizationInsightKey;
  label: string;
  shortLabel: string;
  potential: number;
  realized: number;
  recommendations: number;
  color: string;
};

export const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const optimizationInsights: SavingInsight[] = [
  {
    key: "rightsizing",
    label: "Rightsizing",
    shortLabel: "Right sizing",
    potential: 11900,
    realized: 4300,
    recommendations: 16,
    color: "#8fca66",
  },
  {
    key: "idle-resources",
    label: "Idle Resources",
    shortLabel: "Idle resources",
    potential: 7800,
    realized: 2100,
    recommendations: 12,
    color: "#b99abf",
  },
  {
    key: "commitments",
    label: "Commitments",
    shortLabel: "Commitments",
    potential: 5400,
    realized: 1900,
    recommendations: 8,
    color: "#89b5cf",
  },
];

export function buildDonutGradient(items: Array<{ potential: number; color: string }>): string {
  const total = items.reduce((sum, item) => sum + item.potential, 0);
  if (!total) {
    return "conic-gradient(#d8e7e5 0deg, #d8e7e5 360deg)";
  }

  let cursor = 0;
  const slices = items.map((item) => {
    const angle = (item.potential / total) * 360;
    const start = cursor;
    cursor += angle;
    return `${item.color} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${slices.join(", ")})`;
}
