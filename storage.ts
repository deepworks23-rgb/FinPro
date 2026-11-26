import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const S3_BUCKET = process.env.S3_BUCKET || 'financa';

let client: S3Client | null = null;

/**
 * Checks whether S3-compatible Neon Object Storage credentials and endpoint are configured.
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_ENDPOINT_URL_S3
  );
}

function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({ forcePathStyle: true });
  }
  return client;
}

/**
 * Uploads an object to the configured S3 bucket.
 */
export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    })
  );
}

/**
 * Generates a presigned GET URL for a private object in the S3 bucket.
 */
export async function getPresignedObjectUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn }
  );
}

/**
 * Deletes an object from the configured S3 bucket.
 */
export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })
  );
}
