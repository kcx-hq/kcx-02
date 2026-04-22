import { Ec2OverviewRepository } from "./ec2-overview.repository.js";
import type { Ec2OverviewQuery, Ec2OverviewResponse } from "./ec2-overview.types.js";

export class Ec2OverviewService {
  private readonly repository: Ec2OverviewRepository;

  constructor(repository: Ec2OverviewRepository = new Ec2OverviewRepository()) {
    this.repository = repository;
  }

  async getEc2Overview(input: Ec2OverviewQuery): Promise<Ec2OverviewResponse> {
    const [kpis, trends, topCostlyInstances, filterOptions] = await Promise.all([
      this.repository.getKpis(input),
      this.repository.getTrends(input),
      this.repository.getTopCostlyInstances(input, 10),
      this.repository.getFilterOptions(input),
    ]);

    return {
      section: "ec2-overview",
      title: "EC2 Overview",
      message: "EC2 overview loaded",
      filtersApplied: {
        tenantId: input.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        cloudConnectionId: input.cloudConnectionId,
        subAccountKey: input.subAccountKey,
        regionKey: input.regionKey,
        instanceType: input.instanceType,
        state: input.state,
      },
      kpis,
      trends,
      topCostlyInstances,
      filterOptions,
    };
  }
}

