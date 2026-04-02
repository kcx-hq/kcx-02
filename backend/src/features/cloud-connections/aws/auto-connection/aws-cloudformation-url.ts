type AwsCloudFormationUrlInput = {
  templateUrl: string;
  stackName: string;
  externalId: string;
  connectionName: string;
  region: string;
  exportPrefix?: string;
  exportName?: string;
  callbackUrl?: string;
  callbackToken?: string;
};

export const KCX_AWS_CLOUDFORMATION_TEMPLATE_URL =
  "https://kcx-cloudformation-templates.s3.us-east-1.amazonaws.com/aws-template2.yaml";

export function buildAwsCloudFormationCreateStackUrl({
  templateUrl,
  stackName,
  externalId,
  connectionName,
  region,
  exportPrefix,
  exportName,
  callbackUrl,
  callbackToken,
}: AwsCloudFormationUrlInput): string {
  const base = "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review";

  const queryItems: Array<[string, string]> = [
    ["templateURL", templateUrl],
    ["stackName", stackName],
    ["param_ExternalId", externalId],
    ["param_ConnectionName", connectionName],
    ["region", region],
  ];

  if (exportPrefix) {
    queryItems.push(["param_ExportPrefix", exportPrefix]);
  }

  if (exportName) {
    queryItems.push(["param_ExportName", exportName]);
  }

  if (callbackUrl) {
    queryItems.push(["param_CallbackUrl", callbackUrl]);
  }

  if (callbackToken) {
    queryItems.push(["param_CallbackToken", callbackToken]);
  }

  const query = queryItems
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${base}?${query}`;
}
