# Cost Category Classification

## Purpose
EC2 Explorer cost-category classifier. Produces Explorer-level categories (not transfer subtypes).

## Inputs
- `usageType`, `productUsageType`, `productFamily`, `operation`, `lineItemDescription`
- `fromLocation`, `toLocation`, `fromRegionCode`, `toRegionCode`

## Output
One of:
- `compute`
- `data_transfer`
- `ebs`
- `snapshot`
- `elastic_ip`
- `load_balancer`
- `nat_gateway`
- `other`

## Rules
- nat keywords -> `nat_gateway`
- elastic ip keywords -> `elastic_ip`
- load balancer keywords -> `load_balancer`
- internet/external markers OR region-code transfer shape OR transfer tokens -> `data_transfer`
- snapshot tokens -> `snapshot`
- ebs/volume/storage-type tokens -> `ebs`
- compute/instance tokens -> `compute`
- else `other`

## Priority / Order
1. nat_gateway
2. elastic_ip
3. load_balancer
4. data_transfer
5. snapshot
6. ebs
7. compute
8. other

## Edge Cases
- Data transfer is a single Explorer category; transfer subtypes are handled by data-transfer classifier.
- Region code presence alone can map to `data_transfer`.

## Example Inputs & Outputs
- Input: `usageType=NatGateway-Bytes`
  Output: `nat_gateway`
- Input: `fromRegionCode=us-east-1, toRegionCode=us-west-2`
  Output: `data_transfer`
- Input: `lineItemDescription=EBS:VolumeUsage.gp3`
  Output: `ebs`
