// Cloudflare R2 storage adapter using fetch-based S3 signing
// Works in Cloudflare Workers without node:https dependency

import type { StorageAdapter, SignedUrlResult, UploadResult, DeleteResult } from "./types";

function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(k => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}

async function sha256(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSigningKey(secret: string, date: string, region: string, service: string) {
  let key: ArrayBuffer = new TextEncoder().encode("AWS4" + secret).buffer;
  for (const part of [date, region, service, "aws4_request"]) {
    key = await hmacSha256(key, part);
  }
  return key;
}

async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: string | Uint8Array | null,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
) {
  const now = new Date();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateShort = date.slice(0, 8);
  const scope = `${dateShort}/${region}/s3/aws4_request`;

  headers["x-amz-date"] = date;
  headers["x-amz-content-sha256"] = body ? await sha256(typeof body === "string" ? body : body) : "UNSIGNED-PAYLOAD";

  const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(";");
  const canonicalHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort()
    .map(k => `${k}:${headers[Object.keys(headers).find(h => h.toLowerCase() === k)!].trim()}`).join("\n") + "\n";

  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1),
    canonicalHeaders,
    signedHeaders,
    headers["x-amz-content-sha256"],
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, await sha256(canonicalRequest)].join("\n");
  const signingKey = await getSigningKey(secretAccessKey, dateShort, region, "s3");
  const signatureBuf = await hmacSha256(signingKey, stringToSign);
  const signature = [...new Uint8Array(signatureBuf)].map(b => b.toString(16).padStart(2, "0")).join("");

  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

export class R2StorageAdapter implements StorageAdapter {
  private endpoint: string;
  private bucketName: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor() {
    const accountId = process.env["R2_ACCOUNT_ID"];
    this.accessKeyId = process.env["R2_ACCESS_KEY_ID"] ?? "";
    this.secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"] ?? "";
    this.endpoint = process.env["R2_ENDPOINT"] ?? "";
    this.bucketName = process.env["R2_BUCKET_NAME"] ?? "ciago-bucket";

    if (!accountId || !this.accessKeyId || !this.secretAccessKey || !this.endpoint) {
      throw new Error("Missing R2 environment variables");
    }
  }

  async createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<SignedUrlResult> {
    try {
      const key = `${bucket}/${path}`;
      const url = new URL(`/${this.bucketName}/${key}`, this.endpoint);
      const now = new Date();
      const date = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
      const dateShort = date.slice(0, 8);
      const scope = `${dateShort}/auto/s3/aws4_request`;

      url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
      url.searchParams.set("X-Amz-Credential", `${this.accessKeyId}/${scope}`);
      url.searchParams.set("X-Amz-Date", date);
      url.searchParams.set("X-Amz-Expires", String(expiresIn));
      url.searchParams.set("X-Amz-SignedHeaders", "host");

      const canonicalRequest = [
        "GET", url.pathname, url.searchParams.toString(),
        `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD",
      ].join("\n");

      const stringToSign = ["AWS4-HMAC-SHA256", date, scope, await sha256(canonicalRequest)].join("\n");
      const signingKey = await getSigningKey(this.secretAccessKey, dateShort, "auto", "s3");
      const sig = await hmacSha256(signingKey, stringToSign);
      const signature = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");

      url.searchParams.set("X-Amz-Signature", signature);
      return { signedUrl: url.toString(), error: null };
    } catch (e: any) {
      return { signedUrl: null, error: e?.message ?? String(e) };
    }
  }

  async upload(
    bucket: string,
    path: string,
    file: Buffer | ReadableStream | Uint8Array,
    contentType?: string,
  ): Promise<UploadResult> {
    try {
      const key = `${bucket}/${path}`;
      const url = new URL(`/${this.bucketName}/${key}`, this.endpoint);
      const body = file instanceof ReadableStream ? await streamToUint8Array(file) :
        file instanceof Uint8Array ? file : new Uint8Array(file);
      const headers: Record<string, string> = {
        "host": url.host,
        ...(contentType ? { "content-type": contentType } : {}),
      };
      await signRequest("PUT", url, headers, body, this.accessKeyId, this.secretAccessKey, "auto");
      const res = await fetch(url.toString(), { method: "PUT", headers, body });
      if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
      return { path: key, error: null };
    } catch (e: any) {
      return { path: null, error: e?.message ?? String(e) };
    }
  }

  async remove(bucket: string, paths: string[]): Promise<DeleteResult> {
    try {
      if (paths.length === 0) return { success: true, error: null };
      for (const p of paths) {
        const key = `${bucket}/${p}`;
        const url = new URL(`/${this.bucketName}/${key}`, this.endpoint);
        const headers: Record<string, string> = { "host": url.host };
        await signRequest("DELETE", url, headers, null, this.accessKeyId, this.secretAccessKey, "auto");
        await fetch(url.toString(), { method: "DELETE", headers });
      }
      return { success: true, error: null };
    } catch (e: any) {
      return { success: false, error: e?.message ?? String(e) };
    }
  }
}

async function streamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
