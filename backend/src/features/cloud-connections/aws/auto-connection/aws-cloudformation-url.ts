type AwsCloudFormationUrlInput = {
  stackName: string;
  externalId: string;
  connectionName: string;
  region: string;
  fileEventCallbackUrl: string;
  exportPrefix?: string;
  exportName?: string;
  callbackUrl?: string;
  callbackToken?: string;
  enableBillingExport?: boolean;
  enableActionRole?: boolean;
  enableEC2Module?: boolean;
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
  callbackUrl,
  callbackToken,
  enableBillingExport = true,
  enableActionRole = true,
  enableEC2Module = true,
  useTagScopedAccess = false,
  resourceTagKey,
  resourceTagValue,
}: AwsCloudFormationUrlInput): string {
  const base =
    "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review";

  const parentTemplateUrl = process.env.AWS_PARENT_TEMPLATE_URL?.trim();
  const billingTemplateUrl = process.env.AWS_BILLING_TEMPLATE_URL?.trim();
  const actionRoleTemplateUrl = process.env.AWS_ACTION_ROLE_TEMPLATE_URL?.trim();
  const ec2ModuleTemplateUrl = process.env.AWS_EC2_MODULE_TEMPLATE_URL?.trim();
  const fileEventCallbackUrl = process.env.AWS_FILE_EVENT_CALLBACK_URL?.trim();
  const kcxPrincipalArn =
    process.env.AWS_KCX_PRINCIPAL_ARN?.trim() ||
    "arn:aws:iam::275017715736:root";

  if (!parentTemplateUrl) {
    throw new Error("AWS_PARENT_TEMPLATE_URL is not configured");
  }

  if (enableBillingExport && !billingTemplateUrl) {
    throw new Error("AWS_BILLING_TEMPLATE_URL is not configured");
  }

  if (enableActionRole && !actionRoleTemplateUrl) {
    throw new Error("AWS_ACTION_ROLE_TEMPLATE_URL is not configured");
  }

  if (enableEC2Module && !ec2ModuleTemplateUrl) {
    throw new Error("AWS_EC2_MODULE_TEMPLATE_URL is not configured");
  }

  if (enableBillingExport && !callbackUrl?.trim()) {
    throw new Error("callbackUrl is required when billing export is enabled");
  }

  if (enableBillingExport && !callbackToken?.trim()) {
    throw new Error("callbackToken is required when billing export is enabled");
  }

  if (enableBillingExport && !fileEventCallbackUrl) {
    throw new Error("AWS_FILE_EVENT_CALLBACK_URL is not configured");
  }

  const queryItems: Array<[string, string]> = [
    ["templateURL", parentTemplateUrl],
    ["stackName", stackName],
    ["param_ExternalId", externalId],
    ["param_ConnectionName", connectionName],
    ["param_KcxPrincipalArn", kcxPrincipalArn],
    ["param_EnableBillingExport", enableBillingExport ? "true" : "false"],
    ["param_EnableActionRole", enableActionRole ? "true" : "false"],
    ["param_EnableEC2Module", enableEC2Module ? "true" : "false"],
    ["param_UseTagScopedAccess", useTagScopedAccess ? "true" : "false"],
    ["region", region],
  ];

  if (billingTemplateUrl) {
    queryItems.push(["param_BillingTemplateUrl", billingTemplateUrl]);
  }

  if (actionRoleTemplateUrl) {
    queryItems.push(["param_ActionRoleTemplateUrl", actionRoleTemplateUrl]);
  }

  if (ec2ModuleTemplateUrl) {
    queryItems.push(["param_Ec2ModuleTemplateUrl", ec2ModuleTemplateUrl]);
  }

  if (enableBillingExport && callbackUrl?.trim()) {
    queryItems.push(["param_CallbackUrl", callbackUrl.trim()]);
  }

  if (enableBillingExport && callbackToken?.trim()) {
    queryItems.push(["param_CallbackToken", callbackToken.trim()]);
  }

  if (enableBillingExport && fileEventCallbackUrl) {
    queryItems.push(["param_FileEventCallbackUrl", fileEventCallbackUrl]);
  }

  if (exportPrefix?.trim()) {
    queryItems.push(["param_ExportPrefix", exportPrefix.trim()]);
  }

  if (exportName?.trim()) {
    queryItems.push(["param_ExportName", exportName.trim()]);
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