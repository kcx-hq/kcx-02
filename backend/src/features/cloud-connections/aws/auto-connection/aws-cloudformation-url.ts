export type AwsCloudFormationUrlInput = {
  stackName: string;
  externalId: string;
  connectionName: string;
  region: string;
  fileEventCallbackUrl?: string;
  exportPrefix?: string;
  exportName?: string;
  storageLensExportPrefix?: string;
  storageLensConfigId?: string;
  callbackUrl?: string;
  callbackToken?: string;
  enableBillingExport?: boolean;
  enableCloudTrail?: boolean;
  cloudTrailPrefix?: string;
  cloudTrailName?: string;
  enableActionRole?: boolean;
  enableEC2Module?: boolean;
  enableCloudWatchModule?: boolean;
  useTagScopedAccess?: boolean;
  resourceTagKey?: string;
  resourceTagValue?: string;
};

export const KCX_AWS_CLOUDFORMATION_TEMPLATE_URL =
  process.env.AWS_PARENT_TEMPLATE_URL?.trim() || "";

export function buildAwsCloudFormationCreateStackUrl({
  stackName,
  externalId,
  connectionName,
  region,
  exportPrefix,
  exportName,
  storageLensExportPrefix,
  storageLensConfigId,
  callbackUrl,
  callbackToken,
  enableBillingExport = true,
  enableCloudTrail = false,
  cloudTrailPrefix,
  cloudTrailName,
  enableActionRole = true,
  enableEC2Module = true,
  enableCloudWatchModule = true,
  useTagScopedAccess = false,
  resourceTagKey,
  resourceTagValue,
}: AwsCloudFormationUrlInput): string {
  const base =
    "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review";

  const parentTemplateUrl = process.env.AWS_PARENT_TEMPLATE_URL?.trim();
  const billingTemplateUrl = process.env.AWS_BILLING_TEMPLATE_URL?.trim();
  const cloudTrailTemplateUrl = process.env.AWS_CLOUDTRAIL_TEMPLATE_URL?.trim();
  const actionRoleTemplateUrl = process.env.AWS_ACTION_ROLE_TEMPLATE_URL?.trim();
  const ec2ModuleTemplateUrl = process.env.AWS_EC2_MODULE_TEMPLATE_URL?.trim();
  const cloudWatchModuleTemplateUrl = process.env.AWS_CLOUDWATCH_MODULE_TEMPLATE_URL?.trim();
  const fileEventCallbackUrl =  process.env.AWS_FILE_EVENT_CALLBACK_URL?.trim();
  const kcxPrincipalArn =
    process.env.AWS_KCX_PRINCIPAL_ARN?.trim() ||
    "arn:aws:iam::275017715736:root";
  const effectiveEnableBillingExport = true;
  const effectiveEnableActionRole = enableActionRole || enableEC2Module || enableCloudWatchModule;
  const requiresCallbacks = effectiveEnableBillingExport || enableCloudTrail;

  if (!parentTemplateUrl) {
    throw new Error("AWS_PARENT_TEMPLATE_URL is not configured");
  }

  if (effectiveEnableBillingExport && !billingTemplateUrl) {
    throw new Error("AWS_BILLING_TEMPLATE_URL is not configured");
  }

  if (enableCloudTrail && !cloudTrailTemplateUrl) {
    throw new Error("AWS_CLOUDTRAIL_TEMPLATE_URL is not configured");
  }

  if (effectiveEnableActionRole && !actionRoleTemplateUrl) {
    throw new Error("AWS_ACTION_ROLE_TEMPLATE_URL is not configured");
  }

  if (enableEC2Module && !ec2ModuleTemplateUrl) {
    throw new Error("AWS_EC2_MODULE_TEMPLATE_URL is not configured");
  }

  if (enableCloudWatchModule && !cloudWatchModuleTemplateUrl) {
    throw new Error("AWS_CLOUDWATCH_MODULE_TEMPLATE_URL is not configured");
  }

  if (requiresCallbacks && !callbackUrl?.trim()) {
    throw new Error("callbackUrl is required when billing export or cloudtrail is enabled");
  }

  if (requiresCallbacks && !callbackToken?.trim()) {
    throw new Error("callbackToken is required when billing export or cloudtrail is enabled");
  }

  if (requiresCallbacks && !fileEventCallbackUrl) {
    throw new Error("fileEventCallbackUrl is required when billing export or cloudtrail is enabled");
  }

  const queryItems: Array<[string, string]> = [
    ["templateURL", parentTemplateUrl],
    ["stackName", stackName],
    ["param_ExternalId", externalId],
    ["param_ConnectionName", connectionName],
    ["param_KcxPrincipalArn", kcxPrincipalArn],
    ["param_EnableBillingExport", effectiveEnableBillingExport ? "true" : "false"],
    ["param_EnableCloudTrail", enableCloudTrail ? "true" : "false"],
    ["param_EnableActionRole", effectiveEnableActionRole ? "true" : "false"],
    ["param_EnableEC2Module", enableEC2Module ? "true" : "false"],
    ["param_EnableCloudWatchModule", enableCloudWatchModule ? "true" : "false"],
    ["param_UseTagScopedAccess", useTagScopedAccess ? "true" : "false"],
    ["region", region],
  ];

  if (billingTemplateUrl) {
    queryItems.push(["param_BillingTemplateUrl", billingTemplateUrl]);
  }

  if (cloudTrailTemplateUrl) {
    queryItems.push(["param_CloudTrailTemplateUrl", cloudTrailTemplateUrl]);
  }

  if (actionRoleTemplateUrl) {
    queryItems.push(["param_ActionRoleTemplateUrl", actionRoleTemplateUrl]);
  }

  if (ec2ModuleTemplateUrl) {
    queryItems.push(["param_Ec2ModuleTemplateUrl", ec2ModuleTemplateUrl]);
  }

  if (cloudWatchModuleTemplateUrl) {
    queryItems.push(["param_CloudwatchModuleTemplateUrl", cloudWatchModuleTemplateUrl]);
  }

  if (requiresCallbacks && callbackUrl?.trim()) {
    queryItems.push(["param_CallbackUrl", callbackUrl.trim()]);
  }

  if (requiresCallbacks && callbackToken?.trim()) {
    queryItems.push(["param_CallbackToken", callbackToken.trim()]);
  }

  if (requiresCallbacks && fileEventCallbackUrl) {
    queryItems.push(["param_FileEventCallbackUrl", fileEventCallbackUrl]);
  }

  if (exportPrefix?.trim()) {
    queryItems.push(["param_ExportPrefix", exportPrefix.trim()]);
  }

  if (exportName?.trim()) {
    queryItems.push(["param_ExportName", exportName.trim()]);
  }

  if (storageLensExportPrefix?.trim()) {
    queryItems.push(["param_StorageLensExportPrefix", storageLensExportPrefix.trim()]);
  }

  if (storageLensConfigId?.trim()) {
    queryItems.push(["param_StorageLensConfigId", storageLensConfigId.trim()]);
  }

  if (cloudTrailPrefix?.trim()) {
    queryItems.push(["param_CloudTrailPrefix", cloudTrailPrefix.trim()]);
  }

  if (cloudTrailName?.trim()) {
    queryItems.push(["param_CloudTrailName", cloudTrailName.trim()]);
  }

  if (resourceTagKey?.trim()) {
    queryItems.push(["param_ResourceTagKey", resourceTagKey.trim()]);
  }

  if (resourceTagValue?.trim()) {
    queryItems.push(["param_ResourceTagValue", resourceTagValue.trim()]);
  }

  const query = queryItems
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${base}?${query}`;
}
