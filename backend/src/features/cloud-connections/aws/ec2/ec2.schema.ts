import { z } from "zod";

export const listEc2InstancesQuerySchema = z.object({
  connectionId: z.string().min(1, "connectionId is required"),
});

export const ec2InstanceActionBodySchema = z.object({
  connectionId: z.string().min(1, "connectionId is required"),
  instanceId: z.string().min(1, "instanceId is required"),
});

export const ec2ChangeInstanceTypeBodySchema = z.object({
  connectionId: z.string().min(1, "connectionId is required"),
  instanceId: z.string().min(1, "instanceId is required"),
  targetInstanceType: z.string().min(1, "targetInstanceType is required"),
});

export type ListEc2InstancesQueryInput = z.infer<typeof listEc2InstancesQuerySchema>;
export type Ec2InstanceActionBodyInput = z.infer<typeof ec2InstanceActionBodySchema>;
export type Ec2ChangeInstanceTypeBodyInput = z.infer<typeof ec2ChangeInstanceTypeBodySchema>;
