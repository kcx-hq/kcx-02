import {
  GetObjectCommand,
  type GetObjectCommandInput,
  ListObjectsV2Command,
  type ListObjectsV2CommandInput,
  S3Client,
} from "@aws-sdk/client-s3";

import type { Credentials } from "./aws-sts.service.js";

export type ListedS3Object = {
  key: string;
  size: number;
  etag: string | null;
  lastModified: Date | null;
};

export type ListObjectsParams = {
  client: S3Client;
  bucket: string;
  prefix?: string;
};

export type GetObjectParams = {
  client: S3Client;
  bucket: string;
  key: string;
};

export function createS3Client(region: string, credentials: Credentials): S3Client {
  return new S3Client({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
}

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

  if (typeof stream === "string") {
    return Buffer.from(stream, "utf8");
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

export async function listObjects({ client, bucket, prefix }: ListObjectsParams): Promise<ListedS3Object[]> {
  const normalizedBucket = String(bucket ?? "").trim();
  if (!normalizedBucket) {
    throw new Error("Bucket name is required for S3 listing");
  }

  const objects: ListedS3Object[] = [];
  let continuationToken: string | undefined;

  try {
    do {
      const input: ListObjectsV2CommandInput = {
        Bucket: normalizedBucket,
        Prefix: prefix ? String(prefix).trim() || undefined : undefined,
        ContinuationToken: continuationToken,
      };
      const response = await client.send(new ListObjectsV2Command(input));

      for (const item of response.Contents ?? []) {
        if (!item.Key) continue;
        objects.push({
          key: item.Key,
          size: Number(item.Size ?? 0),
          etag: item.ETag ?? null,
          lastModified: item.LastModified ?? null,
        });
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to list S3 objects for s3://${normalizedBucket}/${prefix ?? ""}: ${reason}`);
  }

  return objects;
}

export async function getObject({ client, bucket, key }: GetObjectParams): Promise<string> {
  const normalizedBucket = String(bucket ?? "").trim();
  const normalizedKey = String(key ?? "").trim();

  if (!normalizedBucket || !normalizedKey) {
    throw new Error("Bucket and key are required for S3 getObject");
  }

  try {
    const input: GetObjectCommandInput = {
      Bucket: normalizedBucket,
      Key: normalizedKey,
    };
    const response = await client.send(new GetObjectCommand(input));
    const bodyBuffer = await streamToBuffer(response.Body);

    // Base64 keeps binary payloads (e.g. parquet) safe while satisfying string return type.
    return bodyBuffer.toString("base64");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download S3 object s3://${normalizedBucket}/${normalizedKey}: ${reason}`);
  }
}
