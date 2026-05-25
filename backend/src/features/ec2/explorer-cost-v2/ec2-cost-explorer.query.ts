import { Ec2ExplorerQuery } from "../explorer/ec2-explorer.query.js";
import { logger } from "../../../utils/logger.js";
import type { Ec2CostExplorerInput, Ec2CostExplorerRawRow } from "./ec2-cost-explorer.types.js";

const toOldCostBasis = (basis: Ec2CostExplorerInput["costBasis"]): "billed_cost" | "effective_cost" | "amortized_cost" | "net_unblended_cost" => {
  if (basis === "gross_cost") return "billed_cost";
  if (basis === "net_cost") return "net_unblended_cost";
  if (basis === "effective_cost") return "effective_cost";
  return "amortized_cost";
};

export class Ec2CostExplorerQuery {
  private base = new Ec2ExplorerQuery();

  private async getRowsForBasisWithFallback(
    input: Ec2CostExplorerInput,
    basis: "gross_cost" | "net_cost" | "effective_cost" | "amortized_cost",
  ) {
    const buildLegacyInput = (costBasis: "billed_cost" | "effective_cost" | "amortized_cost" | "net_unblended_cost") => ({
      scope: input.scope,
      startDate: input.startDate,
      endDate: input.endDate,
      metric: "cost" as const,
      granularity: "daily" as const,
      volumeView: "cost" as const,
      groupBy: "none" as const,
      tagKey: null,
      filters: { regions: input.filters.regions, tags: input.filters.tags },
      costBasis,
      usageType: "cpu" as const,
      aggregation: "avg" as const,
      condition: "all" as const,
      groupValues: [],
      minCost: null,
      maxCost: null,
      minCpu: null,
      maxCpu: null,
      minNetwork: null,
      maxNetwork: null,
      states: [],
      instanceTypes: [],
      teams: [],
      products: [],
      environments: [],
      accounts: [],
      volumeTypes: [],
      volumeAttachment: "all" as const,
      volumeStatuses: [],
      debugDataTransfer: false,
    });

    const primaryBasis = toOldCostBasis(basis);
    try {
      return await this.base.getCurCostRows(buildLegacyInput(primaryBasis));
    } catch (error) {
      const fallbackBasis = basis === "gross_cost" ? "billed_cost" : "effective_cost";
      logger.warn("[EC2 Cost Explorer v2] basis fallback", {
        requestedBasis: basis,
        primaryLegacyBasis: primaryBasis,
        fallbackLegacyBasis: fallbackBasis,
        reason: error instanceof Error ? error.message : "unknown error",
      });
      return this.base.getCurCostRows(buildLegacyInput(fallbackBasis));
    }
  }

  async getRows(input: Ec2CostExplorerInput): Promise<Ec2CostExplorerRawRow[]> {
    const bases: Array<"gross_cost" | "effective_cost" | "amortized_cost"> = [
      "gross_cost",
      "effective_cost",
      "amortized_cost",
    ];
    const map = new Map<string, Ec2CostExplorerRawRow>();

    const chargeCategoryOf = (lineItemType: string | null | undefined): "credit" | "refund" | "other" => {
      const normalized = String(lineItemType ?? "").trim().toLowerCase();
      if (normalized.includes("credit")) return "credit";
      if (normalized.includes("refund")) return "refund";
      return "other";
    };

    for (const basis of bases) {
      const rows = await this.getRowsForBasisWithFallback(input, basis);

      for (const row of rows) {
        const key = [
          row.date,
          row.category,
          row.usageType ?? "",
          row.productUsageType ?? "",
          row.operation ?? "",
          row.lineItemDescription ?? "",
          row.lineItemResourceId ?? "",
          row.fromRegionCode ?? "",
          row.toRegionCode ?? "",
          row.account ?? "",
          row.region ?? "",
          row.instanceType ?? "",
          row.reservationType ?? "",
          row.lineItemType ?? "",
          row.instanceId ?? "",
          row.attachedInstanceId ?? "",
        ].join("::");

        const current = map.get(key) ?? {
          date: row.date,
          category: row.category,
          chargeCategory: String(row.category ?? ""),
          lineItemType: String(row.lineItemType ?? ""),
          pricingModel: String(row.reservationType ?? ""),
          account: row.account,
          region: row.region,
          instanceType: row.instanceType,
          reservationType: row.reservationType,
          instanceId: row.instanceId,
          instanceName: (row as { instanceName?: string | null }).instanceName ?? row.instanceId ?? null,
          attachedInstanceId: row.attachedInstanceId,
          tagsJson: row.tagsJson,
          grossCost: 0,
          rawBilledCost: 0,
          positiveBilledCost: 0,
          credits: 0,
          netCost: 0,
          effectiveCost: 0,
          amortizedCost: 0,
          billedCostSum: 0,
          listCostSum: 0,
          creditRowCount: 0,
          creditBilledSum: 0,
        };

        if (basis === "gross_cost") {
          const category = chargeCategoryOf(row.lineItemType);
          const rawBilledCost = Number((row as { rawCost?: number | null }).rawCost ?? row.cost ?? 0);
          const positiveBilledCost = rawBilledCost > 0 ? rawBilledCost : 0;
          const isCreditLike = category === "credit" || rawBilledCost < 0;
          current.rawBilledCost += rawBilledCost;
          current.positiveBilledCost += positiveBilledCost;
          current.billedCostSum += rawBilledCost;
          // TODO(ec2-cost-explorer): revisit gross/list cost logic when CUR list_cost/public_on_demand_cost is reliably populated.
          current.listCostSum += 0;
          if (isCreditLike) {
            current.credits += Math.abs(Number(rawBilledCost) || 0);
            current.creditRowCount += 1;
            current.creditBilledSum += rawBilledCost;
          } else if (category !== "refund") {
            current.grossCost += positiveBilledCost;
          }
          // Credits are service-level only; chart/table rows keep workload-only gross.
          current.netCost = current.grossCost;
        }
        if (basis === "effective_cost") current.effectiveCost += row.cost;
        if (basis === "amortized_cost") current.amortizedCost += row.cost;
        map.set(key, current);
      }
    }

    return [...map.values()];
  }
}
