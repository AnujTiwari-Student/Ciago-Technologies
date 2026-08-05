// Cloudflare R2 storage adapter using AWS SDK v3
// R2 is S3-compatible, so we use @aws-sdk/client-s3

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, SignedUrlResult, UploadResult, DeleteResult } from "./types";

export class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const accountId = process.env["R2_ACCOUNT_ID"];
    const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
    const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
    const endpoint = process.env["R2_ENDPOINT"];
    this.bucketName = process.env["R2_BUCKET_NAME"] ?? "ciago-bucket";

    if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error(
        "Missing R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT",
      );
    }

    this.client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<SignedUrlResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: `${bucket}/${path}`,
      });
      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return { signedUrl, error: null };
    } catch (e: any) {
      return { signedUrl: null, error: e?.message ?? String(e) };
    }
  }

  async upload(
    bucket: string,
    path: string,
    file: Buffer | ReadableStream,
    contentType?: string,
  ): Promise<UploadResult> {
    try {
      const body = file instanceof Buffer ? file : await streamToBuffer(file as ReadableStream);
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `${bucket}/${path}`,
        Body: body,
        ContentType: contentType,
      });
      await this.client.send(command);
      return { path: `${bucket}/${path}`, error: null };
    } catch (e: any) {
      return { path: null, error: e?.message ?? String(e) };
    }
  }

  async remove(bucket: string, paths: string[]): Promise<DeleteResult> {
    try {
      if (paths.length === 0) return { success: true, error: null };
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: paths.map((p) => ({ Key: `${bucket}/${p}` })),
        },
      });
      await this.client.send(command);
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) };
    }
  }
}

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
