export type ParsedAwsArn = {
  partition: string;
  service: string;
  region: string;
  accountId: string;
  resource: string;
  resourceType: string | null;
  resourceId: string | null;
};

export const parseAwsArn = (arn: string): ParsedAwsArn | null => {
  const normalizedArn = String(arn ?? "").trim();
  if (!normalizedArn.startsWith("arn:")) return null;

  const parts = normalizedArn.split(":");
  if (parts.length < 6) return null;

  const [, partition, service, region, accountId, ...resourceParts] = parts;
  const resource = resourceParts.join(":");
  if (!partition || !service || !resource) return null;

  const slashSplit = resource.split("/");
  const colonSplit = resource.split(":");

  let resourceType: string | null = null;
  let resourceId: string | null = null;

  if (slashSplit.length >= 2) {
    resourceType = slashSplit[0] || null;
    resourceId = slashSplit.slice(1).join("/") || null;
  } else if (colonSplit.length >= 2) {
    resourceType = colonSplit[0] || null;
    resourceId = colonSplit.slice(1).join(":") || null;
  } else {
    resourceId = resource || null;
  }

  return {
    partition,
    service,
    region,
    accountId,
    resource,
    resourceType,
    resourceId,
  };
};
