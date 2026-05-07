import assert from "node:assert/strict";
import test from "node:test";

import { classifyExplorerCostCategory } from "./cost-category-classifier.js";

const baseInput = {
  usageType: null,
  productUsageType: null,
  productFamily: null,
  operation: null,
  lineItemDescription: null,
  lineItemType: null,
  serviceName: null,
  fromLocation: null,
  toLocation: null,
  fromRegionCode: null,
  toRegionCode: null,
};

test("classifies EC2 compute as compute", () => {
  const category = classifyExplorerCostCategory({
    ...baseInput,
    usageType: "BoxUsage:m6i.large",
    operation: "RunInstances",
    productFamily: "Compute Instance",
  });
  assert.equal(category, "compute");
});

test("classifies EBS volume usage as ebs", () => {
  const category = classifyExplorerCostCategory({
    ...baseInput,
    usageType: "EBS:VolumeUsage.gp3",
    productFamily: "Storage",
  });
  assert.equal(category, "ebs");
});

test("classifies EIP usage as elastic_ip", () => {
  const category = classifyExplorerCostCategory({
    ...baseInput,
    usageType: "ElasticIP:IdleAddress",
    lineItemDescription: "Public IPv4 address charge",
  });
  assert.equal(category, "elastic_ip");
});

test("does not classify load balancer rows as an EC2 category", () => {
  const category = classifyExplorerCostCategory({
    ...baseInput,
    usageType: "LoadBalancerUsage",
    productUsageType: "LoadBalancerUsage:Application",
    productFamily: "Load Balancer",
    lineItemDescription: "LoadBalancer LCU usage",
    serviceName: "Amazon Elastic Load Balancing",
  });
  assert.equal(category, "other");
});
