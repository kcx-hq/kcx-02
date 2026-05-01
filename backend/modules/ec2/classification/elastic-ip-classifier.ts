import type { Ec2ElasticIpState } from "./types.js";

const associatedIdRegex = /(i-[a-z0-9]{8,17}|eni-[a-z0-9]{8,17}|nat-[a-z0-9]{8,17}|lb-[a-z0-9-]+)/i;

export const getAssociatedResourceId = (blob: string): string | null => blob.match(associatedIdRegex)?.[1] ?? null;

export const classifyElasticIpState = (blob: string): Ec2ElasticIpState => {
  const normalized = blob.toLowerCase();
  if (normalized.includes("idleaddress")) return "unattached";
  if (normalized.includes("elasticip:idleaddress")) return "unattached";
  return "attached";
};

export const classifyElasticIp = (blob: string): { state: Ec2ElasticIpState; associatedResourceId: string | null } => {
  const associatedResourceId = getAssociatedResourceId(blob);
  if (associatedResourceId) return { state: "attached", associatedResourceId };
  return { state: classifyElasticIpState(blob), associatedResourceId: null };
};
