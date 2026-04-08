import type { Instance, Reservation, Tag } from "@aws-sdk/client-ec2";

export type Ec2InstanceListItem = {
  instanceId: string;
  name: string | null;
  state: string | null;
  instanceType: string | null;
  availabilityZone: string | null;
  privateIp: string | null;
  publicIp: string | null;
  launchTime: string | null;
  tags: Record<string, string | null>;
};

export function extractInstanceNameFromTags(tags: Tag[] | undefined): string | null {
  if (!Array.isArray(tags) || tags.length === 0) return null;

  const nameTag = tags.find((tag) => String(tag.Key ?? "") === "Name");
  const normalizedName = String(nameTag?.Value ?? "").trim();
  return normalizedName || null;
}

const mapTagsToRecord = (tags: Tag[] | undefined): Record<string, string | null> => {
  if (!Array.isArray(tags) || tags.length === 0) return {};

  return tags.reduce<Record<string, string | null>>((accumulator, tag) => {
    const key = String(tag.Key ?? "").trim();
    if (!key) return accumulator;
    accumulator[key] = tag.Value ?? null;
    return accumulator;
  }, {});
};

const mapInstance = (instance: Instance): Ec2InstanceListItem | null => {
  const instanceId = String(instance.InstanceId ?? "").trim();
  if (!instanceId) return null;

  return {
    instanceId,
    name: extractInstanceNameFromTags(instance.Tags),
    state: instance.State?.Name ?? null,
    instanceType: instance.InstanceType ?? null,
    availabilityZone: instance.Placement?.AvailabilityZone ?? null,
    privateIp: instance.PrivateIpAddress ?? null,
    publicIp: instance.PublicIpAddress ?? null,
    launchTime: instance.LaunchTime ? instance.LaunchTime.toISOString() : null,
    tags: mapTagsToRecord(instance.Tags),
  };
};

export const flattenEc2Reservations = (
  reservations: Reservation[] | undefined,
): Ec2InstanceListItem[] => {
  if (!Array.isArray(reservations) || reservations.length === 0) return [];

  return reservations.flatMap((reservation) => {
    const instances = reservation.Instances ?? [];
    return instances
      .map((instance) => mapInstance(instance))
      .filter((instance): instance is Ec2InstanceListItem => Boolean(instance));
  });
};
