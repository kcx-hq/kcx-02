import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDataTransferSignals,
  isDataTransferCandidate,
} from "./data-transfer-classifier.js";

const baseInput = {
  usageType: "DataTransfer-Out-Bytes",
  productUsageType: "DataTransfer-Out-Bytes",
  productFamily: "Data Transfer",
  operation: "RunInstances",
  lineItemDescription: "AWS Data Transfer",
  fromLocation: null,
  toLocation: "Internet",
  fromRegionCode: null,
  toRegionCode: null,
};

test("classifies internet out", () => {
  const result = classifyDataTransferSignals(baseInput);
  assert.equal(result.isDataTransferCandidate, true);
  assert.equal(result.transferType, "internet");
  assert.equal(result.transferDirection, "internet_out");
});

test("classifies internet in", () => {
  const result = classifyDataTransferSignals({
    ...baseInput,
    usageType: "DataTransfer-In-Bytes",
    productUsageType: "DataTransfer-In-Internet",
    toLocation: null,
    fromLocation: "Internet",
  });
  assert.equal(result.transferType, "internet");
  assert.equal(result.transferDirection, "internet_in");
});

test("classifies inter-region", () => {
  const result = classifyDataTransferSignals({
    ...baseInput,
    usageType: "AWS-DataTransfer-Regional-Bytes",
    productUsageType: "InterRegion-Bytes",
    toLocation: "us-west-2",
    fromLocation: "us-east-1",
  });
  assert.equal(result.transferType, "inter_region");
  assert.equal(result.transferDirection, "inter_region");
});

test("classifies inter-AZ", () => {
  const result = classifyDataTransferSignals({
    ...baseInput,
    usageType: "DataTransfer-InterAZ-In-Bytes",
    productUsageType: "InterAZ",
    lineItemDescription: "Inter-AZ transfer",
  });
  assert.equal(result.transferType, "inter_az");
  assert.equal(result.transferDirection, "inter_az");
});

test("classifies regional", () => {
  const result = classifyDataTransferSignals({
    ...baseInput,
    usageType: "DataTransfer-Regional-Bytes",
    productUsageType: "SameRegion",
    toLocation: "us-east-1",
    fromLocation: "us-east-1",
  });
  assert.equal(result.transferType, "regional");
  assert.equal(result.transferDirection, "regional");
});

test("classifies unknown", () => {
  const result = classifyDataTransferSignals({
    ...baseInput,
    usageType: "DataTransfer-Mystery-Bytes",
    productUsageType: "DataTransfer-Other",
    lineItemDescription: "Ambiguous transfer type",
    toLocation: null,
    fromLocation: null,
    toRegionCode: null,
    fromRegionCode: null,
  });
  assert.equal(result.transferType, "unknown");
  assert.equal(result.transferDirection, "unknown");
});

test("excludes NAT Gateway charges", () => {
  const row = {
    ...baseInput,
    usageType: "NatGateway-Bytes",
    productFamily: "NAT Gateway",
    lineItemDescription: "NAT Gateway Data Processing",
  };
  assert.equal(isDataTransferCandidate(row), false);
  assert.equal(classifyDataTransferSignals(row).isDataTransferCandidate, false);
});

test("excludes Load Balancer LCU charges", () => {
  const row = {
    ...baseInput,
    usageType: "LoadBalancerUsage",
    productFamily: "Load Balancer",
    lineItemDescription: "LoadBalancer LCU usage",
  };
  assert.equal(isDataTransferCandidate(row), false);
  assert.equal(classifyDataTransferSignals(row).isDataTransferCandidate, false);
});

test("excludes EIP charges", () => {
  const row = {
    ...baseInput,
    usageType: "ElasticIP:IdleAddress",
    productFamily: "Public IPv4 Address",
    lineItemDescription: "Elastic IP charge",
  };
  assert.equal(isDataTransferCandidate(row), false);
  assert.equal(classifyDataTransferSignals(row).isDataTransferCandidate, false);
});

test("excludes compute, ebs, and snapshot rows", () => {
  const compute = { ...baseInput, usageType: "BoxUsage:t3.medium", productFamily: "Compute Instance" };
  const ebs = { ...baseInput, usageType: "EBS:VolumeUsage.gp3", productFamily: "Storage" };
  const snapshot = { ...baseInput, usageType: "EBS:SnapshotUsage", productFamily: "Storage Snapshot" };
  assert.equal(isDataTransferCandidate(compute), false);
  assert.equal(isDataTransferCandidate(ebs), false);
  assert.equal(isDataTransferCandidate(snapshot), false);
});
