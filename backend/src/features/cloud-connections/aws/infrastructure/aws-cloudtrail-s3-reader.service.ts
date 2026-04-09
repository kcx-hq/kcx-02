import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import env from "../../../../config/env.js";
import { assumeRole } from "./aws-sts.service.js";

type DownloadCloudtrailObjectParams = {
  bucket: string;
  key: string;
  region?: string | null;
  roleArn?: string | null;
  externalId?: string | null;
};

const requireNonEmpty = (value: string | null | undefined, fieldName: string): string => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
};

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) {
    throw new Error("S3 object body is empty");
  }

  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  if (stream instanceof Uint8Array) {
    return Buffer.from(stream);
  }

  if (
    typeof stream === "object" &&
    stream !== null &&
    "transformToByteArray" in stream &&
    typeof stream.transformToByteArray === "function"
  ) {
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<unknown>) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(String(chunk), "utf8"));
    }
  }

  return Buffer.concat(chunks);
}

const buildCloudtrailS3Client = async ({
  region,
  roleArn,
  externalId,
}: {
  region: string;
  roleArn?: string | null;
  externalId?: string | null;
}): Promise<S3Client> => {
  const normalizedRoleArn = String(roleArn ?? "").trim();
  if (!normalizedRoleArn) {
    // No role provided: rely on default AWS credential provider chain.
    return new S3Client({ region });
  }

  const credentials = await assumeRole(normalizedRoleArn, externalId ?? null);
  return new S3Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
};

export async function downloadCloudtrailObject({
  bucket,
  key,
  region,
  roleArn,
  externalId,
}: DownloadCloudtrailObjectParams): Promise<Buffer> {
  const normalizedBucket = requireNonEmpty(bucket, "bucket");
  const normalizedKey = requireNonEmpty(key, "key");
  const resolvedRegion = String(region ?? "").trim() || env.awsRegion || "us-east-1";

  const client = await buildCloudtrailS3Client({
    region: resolvedRegion,
    roleArn,
    externalId,
  });

  const response = await client.send(
    new GetObjectCommand({
      Bucket: normalizedBucket,
      Key: normalizedKey,
    }),
  );

  return streamToBuffer(response.Body);
}
