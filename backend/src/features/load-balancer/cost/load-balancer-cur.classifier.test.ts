import assert from "node:assert/strict";
import test from "node:test";

import { classifyLoadBalancerCurLineItem } from "./load-balancer-cur.classifier.js";

test("classifies fixed load balancer usage", () => {
  const result = classifyLoadBalancerCurLineItem({
    productProductName: "Amazon Elastic Load Balancing",
    usageType: "LoadBalancerUsage",
  });

  assert.equal(result.isLoadBalancer, true);
  assert.equal(result.costComponent, "fixed");
  assert.equal(result.matchedPattern, "loadbalancerusage");
});

test("classifies LCU usage", () => {
  const result = classifyLoadBalancerCurLineItem({
    serviceName: "Amazon Elastic Load Balancing",
    usageType: "USE1-LCUUsage",
  });

  assert.equal(result.isLoadBalancer, true);
  assert.equal(result.costComponent, "lcu");
  assert.equal(result.matchedPattern, "lcuusage");
});

test("classifies data processing usage", () => {
  const result = classifyLoadBalancerCurLineItem({
    productName: "Amazon Elastic Load Balancing",
    productUsageType: "DataProcessing-Bytes",
  });

  assert.equal(result.isLoadBalancer, true);
  assert.equal(result.costComponent, "data_processing");
  assert.equal(result.matchedPattern, "dataprocessing-bytes");
});

test("extracts LB arn from line item resource id", () => {
  const arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/my-alb/abc123";
  const result = classifyLoadBalancerCurLineItem({
    usageType: "LCUUsage",
    lineItemResourceId: arn,
  });

  assert.equal(result.isLoadBalancer, true);
  assert.equal(result.resourceArn, arn);
  assert.equal(result.normalizedResourceId, arn);
});

test("uses normalized resource id when explicit line item resource id is absent", () => {
  const arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/net/my-nlb/xyz987";
  const result = classifyLoadBalancerCurLineItem({
    productProductName: "Amazon Elastic Load Balancing",
    normalizedResourceId: arn,
  });

  assert.equal(result.isLoadBalancer, true);
  assert.equal(result.costComponent, "other");
  assert.equal(result.resourceArn, arn);
  assert.equal(result.normalizedResourceId, arn);
});

test("returns non-load-balancer for unrelated lines", () => {
  const result = classifyLoadBalancerCurLineItem({
    productProductName: "Amazon Elastic Compute Cloud",
    usageType: "BoxUsage:t3.medium",
  });

  assert.equal(result.isLoadBalancer, false);
  assert.equal(result.costComponent, "other");
  assert.equal(result.matchedPattern, null);
});

