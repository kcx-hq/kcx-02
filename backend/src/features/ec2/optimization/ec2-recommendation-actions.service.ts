import {
  CreateSnapshotCommand,
  DeleteSnapshotCommand,
  DeleteVolumeCommand,
  DescribeAddressesCommand,
  DescribeInstancesCommand,
  DescribeSnapshotsCommand,
  DescribeVolumesCommand,
  EC2Client,
  ModifyInstanceAttributeCommand,
  ReleaseAddressCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";

import env from "../../../config/env.js";
import { BadRequestError, NotFoundError } from "../../../errors/http-errors.js";
import { CloudConnectionV2 } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { assumeRole } from "../../cloud-connections/aws/infrastructure/aws-sts.service.js";
import { Ec2RecommendationsRepository } from "./ec2-recommendations.repository.js";
import type { Ec2RecommendationStatus } from "./ec2-recommendations.types.js";

type ActionKey =
  | "stop_instance"
  | "resize_instance"
  | "delete_volume"
  | "snapshot_then_delete_volume"
  | "delete_snapshot"
  | "release_eip"
  | "review_ri_sp"
  | "review_traffic"
  | "review_load_balancer"
  | "terminate_instance";

type ActionRequest = {
  actionKey: ActionKey;
  parameters?: {
    targetInstanceType?: string;
    createSnapshotBeforeDelete?: boolean;
    confirmationText?: string;
  } | null;
};

type RecommendationRow = Awaited<ReturnType<Ec2RecommendationsRepository["getRecommendationById"]>>;

const ADVISORY_TYPES = new Set([
  "uncovered_on_demand",
  "high_internet_data_transfer",
  "high_inter_region_data_transfer",
  "high_inter_az_data_transfer",
  "low_cpu_high_network",
  "high_nat_gateway_cost",
  "idle_load_balancer",
  "low_traffic_load_balancer",
  "unhealthy_targets",
  "high_error_rate",
  "high_data_processing_cost",
]);

const ACTION_RULES: Record<ActionKey, { advisory: boolean; destructive: boolean }> = {
  stop_instance: { advisory: false, destructive: false },
  resize_instance: { advisory: false, destructive: false },
  delete_volume: { advisory: false, destructive: true },
  snapshot_then_delete_volume: { advisory: false, destructive: true },
  delete_snapshot: { advisory: false, destructive: true },
  release_eip: { advisory: false, destructive: true },
  review_ri_sp: { advisory: true, destructive: false },
  review_traffic: { advisory: true, destructive: false },
  review_load_balancer: { advisory: true, destructive: false },
  terminate_instance: { advisory: true, destructive: true },
};

const normalize = (value: string | null | undefined): string => String(value ?? "").trim().toLowerCase();
const asText = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
};

const isDryRunSuccess = (error: unknown): boolean => {
  const code = String((error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code ?? "");
  const message = String((error as { message?: string })?.message ?? "");
  return code.toLowerCase().includes("dryrun") || message.toLowerCase().includes("dryrunoperation");
};

const assertRealActionsEnabled = (): void => {
  if (!env.enableEc2RealActions) {
    throw new BadRequestError("Real EC2 actions are disabled. Set ENABLE_EC2_REAL_ACTIONS=true to enable.");
  }
};

const resolveActionForRecommendation = (row: NonNullable<RecommendationRow>, actionKey: ActionKey): void => {
  const t = row.type;
  const allowed =
    (actionKey === "stop_instance" && t === "idle_instance") ||
    (actionKey === "resize_instance" && (t === "underutilized_instance" || t === "overutilized_instance")) ||
    (actionKey === "delete_volume" && t === "unattached_volume") ||
    (actionKey === "snapshot_then_delete_volume" && t === "unattached_volume") ||
    (actionKey === "delete_snapshot" && (t === "old_snapshot" || t === "orphaned_snapshot")) ||
    (actionKey === "release_eip" && t === "unattached_elastic_ip") ||
    (actionKey === "review_ri_sp" && t === "uncovered_on_demand") ||
    (actionKey === "review_traffic" && ADVISORY_TYPES.has(t) && row.category === "network") ||
    (actionKey === "review_load_balancer" && row.resourceType === "load_balancer") ||
    actionKey === "terminate_instance";
  if (!allowed) {
    throw new BadRequestError("Action is not allowed for this recommendation type.");
  }
};

const getClient = async (tenantId: string, cloudConnectionId: string, regionHint?: string | null): Promise<EC2Client> => {
  const connection = await CloudConnectionV2.findOne({
    where: {
      id: cloudConnectionId,
      tenantId,
    },
  });
  if (!connection) throw new NotFoundError("Cloud connection not found for recommendation");
  if (!connection.actionRoleArn || !connection.externalId) {
    throw new BadRequestError("AWS action role configuration missing for this cloud connection");
  }
  const assumed = await assumeRole(connection.actionRoleArn, connection.externalId);
  const region = asText(regionHint) ?? asText(connection.region) ?? "us-east-1";
  return new EC2Client({
    region,
    credentials: {
      accessKeyId: assumed.accessKeyId,
      secretAccessKey: assumed.secretAccessKey,
      sessionToken: assumed.sessionToken,
    },
  });
};

export class Ec2RecommendationActionsService {
  private readonly repository: Ec2RecommendationsRepository;

  constructor(repository: Ec2RecommendationsRepository = new Ec2RecommendationsRepository()) {
    this.repository = repository;
  }

  private async loadRecommendation(tenantId: string, recommendationId: number): Promise<NonNullable<RecommendationRow>> {
    const row = await this.repository.getRecommendationById({ tenantId, id: recommendationId });
    if (!row) throw new NotFoundError("Recommendation not found");
    if (!row.resourceId) throw new BadRequestError("Recommendation has no resource id");
    return row;
  }

  async precheck(input: {
    tenantId: string;
    userId: string | null;
    recommendationId: number;
    payload: ActionRequest;
  }): Promise<Record<string, unknown>> {
    const startedAt = new Date().toISOString();
    const row = await this.loadRecommendation(input.tenantId, input.recommendationId);
    resolveActionForRecommendation(row, input.payload.actionKey);

    const warnings: string[] = [];
    const blockers: string[] = [];
    const dryRunSupported = !ACTION_RULES[input.payload.actionKey].advisory && input.payload.actionKey !== "terminate_instance";
    let dryRunPassed: boolean | undefined;

    if (input.payload.actionKey === "terminate_instance") {
      blockers.push("Terminate action is disabled in Safety Mode.");
    }
    if (!row.cloudConnectionId) {
      blockers.push("Recommendation is not mapped to a cloud connection.");
    }
    if (!row.region) {
      warnings.push("Recommendation region is empty; default action region may be used.");
    }
    if (input.payload.actionKey === "resize_instance" && !asText(input.payload.parameters?.targetInstanceType)) {
      blockers.push("targetInstanceType is required for resize action.");
    }

    if (ACTION_RULES[input.payload.actionKey].advisory) {
      dryRunPassed = true;
    } else if (row.cloudConnectionId && blockers.length === 0) {
      assertRealActionsEnabled();
      const client = await getClient(input.tenantId, row.cloudConnectionId, row.region);
      try {
        if (input.payload.actionKey === "stop_instance") {
          const describe = await client.send(new DescribeInstancesCommand({ InstanceIds: [row.resourceId] }));
          const instance = describe.Reservations?.[0]?.Instances?.[0];
          const state = normalize(String(instance?.State?.Name ?? ""));
          if (!instance?.InstanceId) blockers.push("Instance not found.");
          if (state !== "running") blockers.push(`Instance state '${state || "unknown"}' is not eligible for stop.`);
          if (blockers.length === 0) {
            try {
              await client.send(new StopInstancesCommand({ InstanceIds: [row.resourceId], DryRun: true }));
              dryRunPassed = true;
            } catch (error) {
              dryRunPassed = isDryRunSuccess(error);
              if (!dryRunPassed) blockers.push("Dry-run stop check failed.");
            }
          }
        } else if (input.payload.actionKey === "resize_instance") {
          const target = String(input.payload.parameters?.targetInstanceType ?? "").trim();
          const describe = await client.send(new DescribeInstancesCommand({ InstanceIds: [row.resourceId] }));
          const instance = describe.Reservations?.[0]?.Instances?.[0];
          const state = normalize(String(instance?.State?.Name ?? ""));
          if (!instance?.InstanceId) blockers.push("Instance not found.");
          if (!["running", "stopped"].includes(state)) blockers.push(`Instance state '${state || "unknown"}' is not supported for resize.`);
          if (normalize(String(instance?.InstanceType ?? "")) === normalize(target)) blockers.push("Target instance type is same as current.");
          if (blockers.length === 0) {
            try {
              await client.send(new ModifyInstanceAttributeCommand({ InstanceId: row.resourceId, InstanceType: { Value: target }, DryRun: true }));
              dryRunPassed = true;
            } catch (error) {
              dryRunPassed = isDryRunSuccess(error);
              if (!dryRunPassed) blockers.push("Dry-run modify-instance check failed.");
            }
          }
        } else if (input.payload.actionKey === "delete_volume" || input.payload.actionKey === "snapshot_then_delete_volume") {
          const describe = await client.send(new DescribeVolumesCommand({ VolumeIds: [row.resourceId] }));
          const volume = describe.Volumes?.[0];
          const state = normalize(String(volume?.State ?? ""));
          const attachmentCount = (volume?.Attachments ?? []).length;
          if (!volume?.VolumeId) blockers.push("Volume not found.");
          if (state !== "available" || attachmentCount > 0) blockers.push("Volume must be available and unattached.");
          if (blockers.length === 0) {
            try {
              await client.send(new DeleteVolumeCommand({ VolumeId: row.resourceId, DryRun: true }));
              dryRunPassed = true;
            } catch (error) {
              dryRunPassed = isDryRunSuccess(error);
              if (!dryRunPassed) blockers.push("Dry-run delete-volume check failed.");
            }
          }
        } else if (input.payload.actionKey === "delete_snapshot") {
          const describe = await client.send(new DescribeSnapshotsCommand({ SnapshotIds: [row.resourceId], OwnerIds: ["self"] }));
          if (!describe.Snapshots?.[0]?.SnapshotId) blockers.push("Snapshot not found or not owned by account.");
          if (blockers.length === 0) {
            try {
              await client.send(new DeleteSnapshotCommand({ SnapshotId: row.resourceId, DryRun: true }));
              dryRunPassed = true;
            } catch (error) {
              dryRunPassed = isDryRunSuccess(error);
              if (!dryRunPassed) blockers.push("Dry-run delete-snapshot check failed.");
            }
          }
        } else if (input.payload.actionKey === "release_eip") {
          const allocationId = row.resourceId.startsWith("eipalloc-") ? row.resourceId : undefined;
          const publicIp = allocationId ? undefined : row.resourceId;
          const describe = await client.send(
            new DescribeAddressesCommand(allocationId ? { AllocationIds: [allocationId] } : { PublicIps: [publicIp!] }),
          );
          const address = describe.Addresses?.[0];
          if (!address) blockers.push("Elastic IP not found.");
          if (address?.AssociationId || address?.InstanceId || address?.NetworkInterfaceId) {
            blockers.push("Elastic IP is associated and cannot be released.");
          }
          if (blockers.length === 0) {
            try {
              await client.send(new ReleaseAddressCommand(allocationId ? { AllocationId: allocationId, DryRun: true } : { PublicIp: publicIp!, DryRun: true }));
              dryRunPassed = true;
            } catch (error) {
              dryRunPassed = isDryRunSuccess(error);
              if (!dryRunPassed) blockers.push("Dry-run release-address check failed.");
            }
          }
        }
      } catch (error) {
        blockers.push(error instanceof Error ? error.message : "Precheck failed.");
      }
    }

    logger.info("[EC2 Recommendation Action][Precheck]", {
      tenantId: input.tenantId,
      userId: input.userId,
      recommendationId: input.recommendationId,
      actionKey: input.payload.actionKey,
      parameters: input.payload.parameters ?? null,
      blockers,
      warnings,
      dryRunPassed: dryRunPassed ?? null,
      startedAt,
    });

    return {
      allowed: blockers.length === 0,
      actionKey: input.payload.actionKey,
      resourceId: row.resourceId,
      resourceType: row.resourceType,
      region: row.region,
      accountId: row.accountId,
      warnings,
      blockers,
      dryRunSupported,
      dryRunPassed,
    };
  }

  async execute(input: {
    tenantId: string;
    userId: string | null;
    recommendationId: number;
    payload: ActionRequest;
  }): Promise<Record<string, unknown>> {
    const row = await this.loadRecommendation(input.tenantId, input.recommendationId);
    resolveActionForRecommendation(row, input.payload.actionKey);

    if (ACTION_RULES[input.payload.actionKey].advisory) {
      await this.repository.updateRecommendationStatus({
        tenantId: input.tenantId,
        id: row.id,
        status: "in_progress",
        reason: `Action executed: ${input.payload.actionKey}`,
        snoozedUntil: null,
      });
      return {
        success: true,
        actionKey: input.payload.actionKey,
        resourceId: row.resourceId,
        awsRequestId: null,
        resultMessage: "Advisory action marked as in progress.",
        updatedStatus: "in_progress",
      };
    }

    assertRealActionsEnabled();
    if (!row.cloudConnectionId) {
      throw new BadRequestError("Recommendation is missing cloud connection mapping.");
    }

    let resultMessage = "";
    let updatedStatus: Ec2RecommendationStatus = "in_progress";
    let awsRequestId: string | null = null;

    if (input.payload.actionKey === "stop_instance") {
      const { stopInstance } = await import("../../cloud-connections/aws/ec2/ec2.shared.service.js");
      const result = await stopInstance({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        instanceId: row.resourceId,
      });
      resultMessage = result.message;
      updatedStatus = "in_progress";
    } else if (input.payload.actionKey === "resize_instance") {
      const target = String(input.payload.parameters?.targetInstanceType ?? "").trim();
      if (!target) throw new BadRequestError("targetInstanceType is required");
      const { changeInstanceType } = await import("../../cloud-connections/aws/ec2/ec2.shared.service.js");
      const result = await changeInstanceType({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        instanceId: row.resourceId,
        targetInstanceType: target,
      });
      resultMessage = result.message;
      updatedStatus = "in_progress";
    } else if (input.payload.actionKey === "delete_volume") {
      if (input.payload.parameters?.confirmationText !== "DELETE VOLUME") {
        throw new BadRequestError("confirmationText mismatch for delete volume.");
      }
      const { deleteVolume } = await import("../../cloud-connections/aws/ec2/ec2.shared.service.js");
      const result = await deleteVolume({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        volumeId: row.resourceId,
      });
      resultMessage = result.message;
      updatedStatus = "completed";
    } else if (input.payload.actionKey === "snapshot_then_delete_volume") {
      if (input.payload.parameters?.confirmationText !== "DELETE VOLUME") {
        throw new BadRequestError("confirmationText mismatch for snapshot+delete volume.");
      }
      const { createSnapshot, deleteVolume } = await import("../../cloud-connections/aws/ec2/ec2.shared.service.js");
      const snapshot = await createSnapshot({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        volumeId: row.resourceId,
      });
      const deleted = await deleteVolume({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        volumeId: row.resourceId,
      });
      resultMessage = `${snapshot.message} ${deleted.message}`.trim();
      updatedStatus = "in_progress";
    } else if (input.payload.actionKey === "delete_snapshot") {
      if (input.payload.parameters?.confirmationText !== "DELETE SNAPSHOT") {
        throw new BadRequestError("confirmationText mismatch for delete snapshot.");
      }
      const { deleteSnapshot } = await import("../../cloud-connections/aws/ec2/ec2.shared.service.js");
      const result = await deleteSnapshot({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        snapshotId: row.resourceId,
      });
      resultMessage = result.message;
      updatedStatus = "completed";
    } else if (input.payload.actionKey === "release_eip") {
      if (input.payload.parameters?.confirmationText !== "RELEASE EIP") {
        throw new BadRequestError("confirmationText mismatch for release EIP.");
      }
      const { releaseAddress } = await import("../../cloud-connections/aws/ec2/ec2.shared.service.js");
      const result = await releaseAddress({
        tenantId: input.tenantId,
        connectionId: row.cloudConnectionId,
        resourceId: row.resourceId,
      });
      resultMessage = result.message;
      updatedStatus = "completed";
    } else {
      throw new BadRequestError("Unsupported action.");
    }

    await this.repository.updateRecommendationStatus({
      tenantId: input.tenantId,
      id: row.id,
      status: updatedStatus,
      reason: `Action executed: ${input.payload.actionKey}`,
      snoozedUntil: null,
    });

    logger.info("[EC2 Recommendation Action][Execute]", {
      tenantId: input.tenantId,
      userId: input.userId,
      recommendationId: input.recommendationId,
      actionKey: input.payload.actionKey,
      parameters: input.payload.parameters ?? null,
      awsRequestId,
      resultMessage,
      updatedStatus,
    });

    return {
      success: true,
      actionKey: input.payload.actionKey,
      resourceId: row.resourceId,
      awsRequestId,
      resultMessage,
      updatedStatus,
    };
  }
}

export type { ActionKey, ActionRequest };
