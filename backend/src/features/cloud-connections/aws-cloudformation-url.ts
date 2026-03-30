type AwsCloudFormationUrlInput = {
  templateUrl: string;
  stackName: string;
  externalId: string;
  connectionName: string;
  region: string;
};

export const KCX_AWS_CLOUDFORMATION_TEMPLATE_URL =
  "https://kcx-cloudformation-templates.s3.us-east-1.amazonaws.com/aws-template.yaml";

export function buildAwsCloudFormationCreateStackUrl({
  templateUrl,
  stackName,
  externalId,
  connectionName,
  region,
}: AwsCloudFormationUrlInput): string {
  const base = "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review";

  const query = [
    ["templateURL", templateUrl],
    ["stackName", stackName],
    ["param_ExternalId", externalId],
    ["param_ConnectionName", connectionName],
    ["region", region],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${base}?${query}`;
}

