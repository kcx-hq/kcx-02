import { Ec2InstanceHoursRepository } from "./ec2-instance-hours.repository.js";
import type { Ec2InstanceHoursQuery, Ec2InstanceHoursResponse } from "./ec2-instance-hours.types.js";

export class Ec2InstanceHoursService {
  private readonly repository: Ec2InstanceHoursRepository;

  constructor(repository: Ec2InstanceHoursRepository = new Ec2InstanceHoursRepository()) {
    this.repository = repository;
  }

  async getEc2InstanceHours(input: Ec2InstanceHoursQuery): Promise<Ec2InstanceHoursResponse> {
    const items = await this.repository.getInstanceHours(input);

    return {
      section: "ec2-instance-hours",
      title: "EC2 Instance Hours",
      message: "EC2 instance hours report loaded",
      filtersApplied: {
        tenantId: input.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        cloudConnectionId: input.cloudConnectionId,
        subAccountKey: input.subAccountKey,
        regionKey: input.regionKey,
      },
      items,
    };
  }
}

