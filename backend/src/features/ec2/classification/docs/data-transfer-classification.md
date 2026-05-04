# Data Transfer Classification

## Purpose
Classifies transfer lines for EC2 data-transfer views and excludes NAT Gateway from normal transfer flow.

## Inputs
- `usageType`, `productUsageType`, `productFamily`, `operation`, `lineItemDescription`
- `fromLocation`, `toLocation`, `fromRegionCode`, `toRegionCode`

## Output
- `isNatGateway`: boolean
- `isDataTransferCandidate`: boolean
- `transferType`: `internet | inter_region | inter_az | unknown`
- `confidence`: `low | medium | high`

## Rules
- NAT detection uses tokens including `natgateway`, `nat-gateway`, `nat gateway`, `natgateway-bytes`, `dataprocessing-bytes`.
- If NAT is true, output is forced to:
  - `isNatGateway=true`
  - `isDataTransferCandidate=false`
  - `transferType=unknown`
  - `confidence=low`
- Non-NAT transfer candidate excludes Elastic IP and Load Balancer related tokens.
- Transfer type resolution order:
  1. internet/external location markers
  2. region code mismatch -> inter_region
  3. same region code -> inter_az
  4. token fallback (`datatransfer-out`, `aws-out-bytes`) -> internet
  5. unknown

## Priority / Order
- NAT exclusion is applied first.
- Then transfer-candidate and transfer-type classification.

## Edge Cases
- NAT lines never appear as normal Data Transfer candidates.
- Missing region codes fall back to token checks or unknown.

## Example Inputs & Outputs
- Input: `usageType=NatGateway-Bytes`
  Output: `isNatGateway=true, isDataTransferCandidate=false, transferType=unknown, confidence=low`
- Input: `toLocation=Internet`
  Output: `isNatGateway=false, isDataTransferCandidate=true, transferType=internet, confidence=high`
- Input: `fromRegionCode=us-east-1, toRegionCode=eu-west-1`
  Output: `isNatGateway=false, isDataTransferCandidate=true, transferType=inter_region, confidence=high`
