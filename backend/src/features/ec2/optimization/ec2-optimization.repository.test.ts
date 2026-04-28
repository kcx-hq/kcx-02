import assert from "node:assert/strict";
import test from "node:test";

import { FactRecommendations, sequelize } from "../../../models/index.js";
import { Ec2OptimizationRepository } from "./ec2-optimization.repository.js";
import type { Ec2OptimizationPersistableRecommendation } from "./ec2-optimization.types.js";

type TransactionFn = <T>(callback: (transaction: object) => Promise<T>) => Promise<T>;

type StoredRecommendation = {
  id: string;
  tenantId: string;
  cloudConnectionId: string | null;
  billingSourceId: string | number | null;
  awsAccountId: string;
  awsRegionCode: string | null;
  category: string;
  recommendationType: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  currentResourceType: string | null;
  recommendedResourceType: string | null;
  currentMonthlyCost: number;
  estimatedMonthlySavings: number;
  projectedMonthlyCost: number;
  sourceSystem: string;
  status: string;
  effortLevel: string | null;
  riskLevel: string | null;
  recommendationTitle: string | null;
  recommendationText: string | null;
  observationStart: Date | null;
  observationEnd: Date | null;
  rawPayloadJson: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const createRecommendationInput = (
  overrides: Partial<Ec2OptimizationPersistableRecommendation> = {},
): Ec2OptimizationPersistableRecommendation => ({
  tenantId: "tenant-1",
  cloudConnectionId: "00000000-0000-0000-0000-000000000111",
  billingSourceId: 10,
  awsAccountId: "123456789012",
  awsRegionCode: "us-east-1",
  recommendationType: "idle_instance",
  resourceType: "ec2_instance",
  resourceId: "i-abc123",
  resourceName: "app-instance",
  subAccountKey: 1001,
  regionKey: 2001,
  currentResourceType: "m5.large",
  recommendedResourceType: null,
  currentMonthlyCost: 75,
  estimatedMonthlySavings: 75,
  projectedMonthlyCost: 0,
  performanceRiskScore: null,
  performanceRiskLevel: null,
  effortLevel: "low",
  riskLevel: "low",
  recommendationTitle: "Idle EC2 instance detected",
  recommendationText:
    "Instance has been running with average CPU below 5% and low network usage. Consider stopping or terminating it after owner validation.",
  rawPayloadJson: "{\"demo\":true}",
  observationStart: new Date("2026-04-01T00:00:00.000Z"),
  observationEnd: new Date("2026-04-24T00:00:00.000Z"),
  ...overrides,
});

const installFactRecommendationStore = () => {
  const owner = sequelize as unknown as { transaction: TransactionFn };
  const originalTransaction = owner.transaction;
  const originalFindAll = FactRecommendations.findAll;
  const originalCreate = FactRecommendations.create;
  const originalUpdate = FactRecommendations.update;

  const store: StoredRecommendation[] = [];
  let idCounter = 1;

  owner.transaction = async (callback) => callback({});

  FactRecommendations.findAll = (async ({ where }: { where: Record<string, unknown> }) => {
    const tenantId = String(where.tenantId ?? "");
    const sourceSystem = String(where.sourceSystem ?? "");
    const category = String(where.category ?? "");
    const status = String(where.status ?? "");
    const recommendationType = Array.isArray(where.recommendationType)
      ? where.recommendationType.map((item) => String(item))
      : null;
    const cloudConnectionId = typeof where.cloudConnectionId === "string" ? where.cloudConnectionId : undefined;
    const billingSourceId = typeof where.billingSourceId === "string" ? where.billingSourceId : undefined;

    return store.filter((row) => {
      if (row.tenantId !== tenantId) return false;
      if (row.sourceSystem !== sourceSystem) return false;
      if (row.category !== category) return false;
      if (row.status !== status) return false;
      if (recommendationType && !recommendationType.includes(row.recommendationType)) return false;
      if (cloudConnectionId && row.cloudConnectionId !== cloudConnectionId) return false;
      if (billingSourceId && String(row.billingSourceId ?? "") !== billingSourceId) return false;
      return true;
    }) as unknown as ReturnType<typeof FactRecommendations.findAll>;
  }) as typeof FactRecommendations.findAll;

  FactRecommendations.create = (async (payload: Record<string, unknown>) => {
    const row: StoredRecommendation = {
      id: String(idCounter++),
      tenantId: String(payload.tenantId),
      cloudConnectionId: payload.cloudConnectionId ? String(payload.cloudConnectionId) : null,
      billingSourceId:
        payload.billingSourceId === null || typeof payload.billingSourceId === "undefined"
          ? null
          : String(payload.billingSourceId),
      awsAccountId: String(payload.awsAccountId),
      awsRegionCode: payload.awsRegionCode ? String(payload.awsRegionCode) : null,
      category: String(payload.category),
      recommendationType: String(payload.recommendationType),
      resourceType: payload.resourceType ? String(payload.resourceType) : null,
      resourceId: payload.resourceId ? String(payload.resourceId) : null,
      resourceName: payload.resourceName ? String(payload.resourceName) : null,
      currentResourceType: payload.currentResourceType ? String(payload.currentResourceType) : null,
      recommendedResourceType: payload.recommendedResourceType ? String(payload.recommendedResourceType) : null,
      currentMonthlyCost: Number(payload.currentMonthlyCost ?? 0),
      estimatedMonthlySavings: Number(payload.estimatedMonthlySavings ?? 0),
      projectedMonthlyCost: Number(payload.projectedMonthlyCost ?? 0),
      sourceSystem: String(payload.sourceSystem),
      status: String(payload.status),
      effortLevel: payload.effortLevel ? String(payload.effortLevel) : null,
      riskLevel: payload.riskLevel ? String(payload.riskLevel) : null,
      recommendationTitle: payload.recommendationTitle ? String(payload.recommendationTitle) : null,
      recommendationText: payload.recommendationText ? String(payload.recommendationText) : null,
      observationStart:
        payload.observationStart instanceof Date ? payload.observationStart : null,
      observationEnd:
        payload.observationEnd instanceof Date ? payload.observationEnd : null,
      rawPayloadJson: payload.rawPayloadJson ? String(payload.rawPayloadJson) : null,
      createdAt: payload.createdAt instanceof Date ? payload.createdAt : new Date(),
      updatedAt: payload.updatedAt instanceof Date ? payload.updatedAt : new Date(),
    };
    store.push(row);
    return row as unknown as ReturnType<typeof FactRecommendations.create>;
  }) as typeof FactRecommendations.create;

  FactRecommendations.update = (async (payload: Record<string, unknown>, options: { where: { id: string | number } }) => {
    const targetId = String(options.where.id);
    const row = store.find((item) => item.id === targetId);
    if (!row) return [0];

    Object.assign(row, {
      ...(typeof payload.status === "string" ? { status: payload.status } : {}),
      ...(typeof payload.currentMonthlyCost !== "undefined"
        ? { currentMonthlyCost: Number(payload.currentMonthlyCost) }
        : {}),
      ...(typeof payload.estimatedMonthlySavings !== "undefined"
        ? { estimatedMonthlySavings: Number(payload.estimatedMonthlySavings) }
        : {}),
      ...(typeof payload.projectedMonthlyCost !== "undefined"
        ? { projectedMonthlyCost: Number(payload.projectedMonthlyCost) }
        : {}),
      ...(typeof payload.recommendationTitle === "string"
        ? { recommendationTitle: payload.recommendationTitle }
        : {}),
      ...(typeof payload.recommendationText === "string"
        ? { recommendationText: payload.recommendationText }
        : {}),
      ...(typeof payload.recommendedResourceType !== "undefined"
        ? { recommendedResourceType: payload.recommendedResourceType ? String(payload.recommendedResourceType) : null }
        : {}),
      ...(payload.observationStart instanceof Date ? { observationStart: payload.observationStart } : {}),
      ...(payload.observationEnd instanceof Date ? { observationEnd: payload.observationEnd } : {}),
      ...(typeof payload.rawPayloadJson === "string" ? { rawPayloadJson: payload.rawPayloadJson } : {}),
      ...(payload.updatedAt instanceof Date ? { updatedAt: payload.updatedAt } : {}),
    });

    return [1];
  }) as typeof FactRecommendations.update;

  return {
    store,
    restore: () => {
      owner.transaction = originalTransaction;
      FactRecommendations.findAll = originalFindAll;
      FactRecommendations.create = originalCreate;
      FactRecommendations.update = originalUpdate;
    },
  };
};

test("creates new idle recommendation", async () => {
  const mock = installFactRecommendationStore();
  const repository = new Ec2OptimizationRepository();

  try {
    const result = await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-01T00:00:00.000Z"),
      observationEnd: new Date("2026-04-24T00:00:00.000Z"),
      recommendations: [createRecommendationInput()],
      resolveStaleOpen: true,
    });

    assert.equal(result.created, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.resolved, 0);
    assert.equal(mock.store.length, 1);
    assert.equal(mock.store[0]?.recommendationType, "idle_instance");
    assert.equal(mock.store[0]?.status, "OPEN");
  } finally {
    mock.restore();
  }
});

test("updates same recommendation without duplicate", async () => {
  const mock = installFactRecommendationStore();
  const repository = new Ec2OptimizationRepository();

  try {
    await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-01T00:00:00.000Z"),
      observationEnd: new Date("2026-04-24T00:00:00.000Z"),
      recommendations: [createRecommendationInput()],
      resolveStaleOpen: true,
    });

    const result = await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-02T00:00:00.000Z"),
      observationEnd: new Date("2026-04-25T00:00:00.000Z"),
      recommendations: [
        createRecommendationInput({
          currentMonthlyCost: 80,
          estimatedMonthlySavings: 70,
          projectedMonthlyCost: 10,
          rawPayloadJson: "{\"demo\":false}",
        }),
      ],
      resolveStaleOpen: true,
    });

    assert.equal(result.created, 0);
    assert.equal(result.updated, 1);
    assert.equal(mock.store.length, 1);
    assert.equal(mock.store[0]?.currentMonthlyCost, 80);
    assert.equal(mock.store[0]?.estimatedMonthlySavings, 70);
    assert.equal(mock.store[0]?.projectedMonthlyCost, 10);
  } finally {
    mock.restore();
  }
});

test("resolves stale recommendation", async () => {
  const mock = installFactRecommendationStore();
  const repository = new Ec2OptimizationRepository();

  try {
    await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-01T00:00:00.000Z"),
      observationEnd: new Date("2026-04-24T00:00:00.000Z"),
      recommendations: [createRecommendationInput()],
      resolveStaleOpen: true,
    });

    const result = await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-02T00:00:00.000Z"),
      observationEnd: new Date("2026-04-25T00:00:00.000Z"),
      recommendations: [],
      resolveStaleOpen: true,
    });

    assert.equal(result.resolved, 1);
    assert.equal(mock.store[0]?.status, "RESOLVED");
  } finally {
    mock.restore();
  }
});

test("stores underutilized recommendation with savings", async () => {
  const mock = installFactRecommendationStore();
  const repository = new Ec2OptimizationRepository();

  try {
    await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-01T00:00:00.000Z"),
      observationEnd: new Date("2026-04-24T00:00:00.000Z"),
      recommendations: [
        createRecommendationInput({
          recommendationType: "underutilized_instance",
          estimatedMonthlySavings: 45.5,
          projectedMonthlyCost: 54.5,
          recommendationTitle: "Underutilized EC2 instance detected",
          recommendationText:
            "Instance appears oversized based on CPU and network utilization. Consider downsizing to the recommended instance type.",
        }),
      ],
      resolveStaleOpen: false,
    });

    assert.equal(mock.store.length, 1);
    assert.equal(mock.store[0]?.recommendationType, "underutilized_instance");
    assert.equal(mock.store[0]?.estimatedMonthlySavings, 45.5);
    assert.equal(
      mock.store[0]?.recommendationText,
      "Instance appears oversized based on CPU and network utilization. Consider downsizing to the recommended instance type.",
    );
  } finally {
    mock.restore();
  }
});

test("stores uncovered on-demand recommendation", async () => {
  const mock = installFactRecommendationStore();
  const repository = new Ec2OptimizationRepository();

  try {
    await repository.persistEc2Recommendations({
      tenantId: "tenant-1",
      cloudConnectionId: "00000000-0000-0000-0000-000000000111",
      billingSourceId: 10,
      observationStart: new Date("2026-04-01T00:00:00.000Z"),
      observationEnd: new Date("2026-04-24T00:00:00.000Z"),
      recommendations: [
        createRecommendationInput({
          recommendationType: "uncovered_on_demand",
          estimatedMonthlySavings: 22.25,
          projectedMonthlyCost: 52.75,
          recommendationTitle: "Uncovered On-Demand EC2 instance detected",
          recommendationText:
            "Instance is running on On-Demand pricing and may be eligible for Reserved Instance or Savings Plan coverage.",
        }),
      ],
      resolveStaleOpen: false,
    });

    assert.equal(mock.store.length, 1);
    assert.equal(mock.store[0]?.recommendationType, "uncovered_on_demand");
    assert.equal(mock.store[0]?.estimatedMonthlySavings, 22.25);
    assert.equal(
      mock.store[0]?.recommendationText,
      "Instance is running on On-Demand pricing and may be eligible for Reserved Instance or Savings Plan coverage.",
    );
  } finally {
    mock.restore();
  }
});
