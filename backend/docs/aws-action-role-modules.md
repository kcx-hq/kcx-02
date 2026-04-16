# AWS Action Role Module Stacks

This setup keeps service permissions modular:
- `action-role.yaml` creates the cross-account action role that KCX assumes.
- `ec2-module.yaml` attaches EC2 lifecycle permissions to that role.
- `cloudwatch-module.yaml` attaches CloudWatch metric read permissions to that role.

CloudWatch is intentionally separate from EC2 because CloudWatch metrics are cross-service and reused by multiple services (EC2, EBS, RDS, Lambda, EKS, etc.).

## CloudWatch module permissions (v1)

`cloudwatch-module.yaml` grants only:
- `cloudwatch:GetMetricData`
- `cloudwatch:ListMetrics`
- `cloudwatch:GetMetricStatistics`

All on `Resource: "*"`.

No CloudWatch writes, alarms, logs, agent, or observability-link permissions are included.

## Stack deployment flow

1. Deploy base action role stack (`action-role.yaml`) to create the target IAM role.
2. Deploy EC2 module stack (`ec2-module.yaml`) with `ActionRoleName` from step 1.
3. Deploy CloudWatch module stack (`cloudwatch-module.yaml`) with the same `ActionRoleName`.

## Example AWS CLI commands

```bash
# 1) Base action role
aws cloudformation deploy \
  --stack-name kcx-action-role-my-connection \
  --template-file backend/src/templates/action-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ExternalId=kcx-<external-id> \
    ConnectionName=my-connection \
    KcxPrincipalArn=arn:aws:iam::275017715736:root

# 2) EC2 module (attach EC2 permissions to existing action role)
aws cloudformation deploy \
  --stack-name kcx-ec2-module-my-connection \
  --template-file backend/src/templates/ec2-module.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ConnectionName=my-connection \
    ActionRoleName=kcx-my-connection-action-role \
    UseTagScopedAccess=false

# 3) CloudWatch module (attach CloudWatch metric read permissions to existing action role)
aws cloudformation deploy \
  --stack-name kcx-cloudwatch-module-my-connection \
  --template-file backend/src/templates/cloudwatch-module.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ConnectionName=my-connection \
    ActionRoleName=kcx-my-connection-action-role
```

## Parent stack wiring

`parent.yaml` now supports a dedicated CloudWatch module nested stack:
- `EnableCloudWatchModule` (default: `true`)
- `CloudwatchModuleTemplateUrl` (S3 URL for `cloudwatch-module.yaml`)

The parent stack creates the CloudWatch module only when:
- `EnableActionRole=true`
- `EnableCloudWatchModule=true`

