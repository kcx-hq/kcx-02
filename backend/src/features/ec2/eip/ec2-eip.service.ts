import type { Ec2ElasticIpInput, Ec2ElasticIpResponse, Ec2ElasticIpRow } from "./ec2-eip.types.js";
import { Ec2ElasticIpQuery } from "./ec2-eip.query.js";
import { classifyElasticIp } from "../../../../modules/ec2/classification/elastic-ip-classifier.js";

const round2 = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(2));


export class Ec2ElasticIpService {
  private readonly query: Ec2ElasticIpQuery;

  constructor(query: Ec2ElasticIpQuery = new Ec2ElasticIpQuery()) {
    this.query = query;
  }

  async getElasticIps(input: Ec2ElasticIpInput): Promise<Ec2ElasticIpResponse> {
    const rows = await this.query.getLineItems(input);

    let mapped: Ec2ElasticIpRow[] = rows.map((row, index) => {
      const textBlob = [row.usageType, row.operation, row.lineItemType, row.lineItemDescription].filter(Boolean).join(" ");
      const classified = classifyElasticIp(textBlob);
      const associatedResourceId = classified.associatedResourceId;
      const normalizedState: "attached" | "unattached" = classified.state;
      const cost = round2(Math.max(0, Number(row.cost ?? 0)));
      const recommendation = normalizedState === "unattached" ? "Release unused Elastic IP" : null;
      const estimatedSavings = normalizedState === "unattached" ? cost : 0;

      return {
        eipId: (row.eipId ?? "").trim() || `eip-unknown-${index + 1}`,
        publicIp: (row.publicIp ?? "").trim() || "-",
        accountName: (row.accountName ?? "Unknown").trim() || "Unknown",
        accountId: (row.accountId ?? "unknown").trim() || "unknown",
        region: (row.region ?? "unknown").trim() || "unknown",
        state: normalizedState,
        associatedResourceId,
        cost,
        lastSeen: row.usageDate ?? null,
        recommendation,
        estimatedSavings: round2(estimatedSavings),
      };
    });

    if (input.accountId) mapped = mapped.filter((row) => row.accountId === input.accountId);
    if (input.region) mapped = mapped.filter((row) => row.region.toLowerCase() === input.region?.toLowerCase());
    if (input.state !== "all") mapped = mapped.filter((row) => row.state === input.state);
    if (input.search) {
      const query = input.search.toLowerCase();
      mapped = mapped.filter((row) =>
        [row.eipId, row.publicIp, row.accountName, row.accountId, row.region, row.associatedResourceId ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    mapped = mapped.sort((a, b) => b.cost - a.cost);

    const total = mapped.length;
    const start = (input.page - 1) * input.pageSize;
    const paged = mapped.slice(start, start + input.pageSize);

    const totalCost = round2(mapped.reduce((sum, row) => sum + row.cost, 0));
    const unattachedCount = mapped.filter((row) => row.state === "unattached").length;
    const potentialSavings = round2(mapped.reduce((sum, row) => sum + row.estimatedSavings, 0));

    return {
      summary: {
        totalCost,
        totalEips: new Set(mapped.map((row) => row.eipId)).size,
        unattachedCount,
        potentialSavings,
      },
      rows: paged,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
      },
    };
  }
}




