/**
 * Prove R2 upload actually lands in the bucket.
 * Uploads a file, then calls ListObjectsV2 to verify.
 * Does NOT delete. Leaves the object for manual dashboard verification.
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env["R2_ACCOUNT_ID"];
const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
const endpoint = process.env["R2_ENDPOINT"];
const bucketName = process.env["R2_BUCKET_NAME"];

console.log("========================================");
console.log("R2 UPLOAD PROOF");
console.log("========================================\n");

// Step 1-3: Print configuration
console.log("1. Bucket name:        ", bucketName);
console.log("2. Endpoint:           ", endpoint);
console.log("3. Account ID:         ", accountId);
console.log("");

if (!accountId || !accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
  console.error("ERROR: Missing R2 environment variables");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

const objectKey = `proof-test/dashboard-verify-${Date.now()}.txt`;
const content = `This file proves R2 upload works. Created: ${new Date().toISOString()}`;

// Step 4: Print object key BEFORE upload
console.log("4. Object key (before upload):", objectKey);
console.log("   Full path in bucket:       ", `${bucketName}/${objectKey}`);
console.log("");

// Step 5: Upload
console.log("5. Uploading...");
const putCommand = new PutObjectCommand({
  Bucket: bucketName,
  Key: objectKey,
  Body: Buffer.from(content, "utf-8"),
  ContentType: "text/plain",
});

const putResult = await client.send(putCommand);
console.log("   PutObject response:");
console.log("     HTTP status:", putResult.$metadata.httpStatusCode);
console.log("     ETag:       ", putResult.ETag);
console.log("     RequestId:  ", putResult.$metadata.requestId);
console.log("");

// Step 5 continued: HeadObject to confirm existence
console.log("6. HeadObject (confirm object exists)...");
const headCommand = new HeadObjectCommand({
  Bucket: bucketName,
  Key: objectKey,
});
const headResult = await client.send(headCommand);
console.log("   HeadObject response:");
console.log("     HTTP status:  ", headResult.$metadata.httpStatusCode);
console.log("     Content-Length:", headResult.ContentLength);
console.log("     Content-Type: ", headResult.ContentType);
console.log("     ETag:         ", headResult.ETag);
console.log("     LastModified: ", headResult.LastModified?.toISOString());
console.log("");

// Step 5 continued: ListObjectsV2 to show all objects
console.log("7. ListObjectsV2 (list all objects in bucket)...");
const listCommand = new ListObjectsV2Command({
  Bucket: bucketName,
  MaxKeys: 100,
});
const listResult = await client.send(listCommand);
console.log("   ListObjectsV2 response:");
console.log("     HTTP status:   ", listResult.$metadata.httpStatusCode);
console.log("     KeyCount:      ", listResult.KeyCount);
console.log("     IsTruncated:   ", listResult.IsTruncated);
console.log("");

if (listResult.Contents && listResult.Contents.length > 0) {
  console.log("   Objects in bucket:");
  for (const obj of listResult.Contents) {
    console.log(`     - Key: ${obj.Key}`);
    console.log(`       Size: ${obj.Size} bytes`);
    console.log(`       LastModified: ${obj.LastModified?.toISOString()}`);
    console.log(`       ETag: ${obj.ETag}`);
    console.log("");
  }
} else {
  console.log("   ⚠️  NO OBJECTS RETURNED BY ListObjectsV2");
  console.log("   This means the upload may not have persisted.");
}

// Step 6: STOP. Do NOT delete.
console.log("========================================");
console.log("⏸️  PAUSED — Object NOT deleted");
console.log("========================================");
console.log("");
console.log("VERIFY MANUALLY IN CLOUDFLARE DASHBOARD:");
console.log("");
console.log("  Bucket:     ", bucketName);
console.log("  Object key: ", objectKey);
console.log("  Content:    ", JSON.stringify(content));
console.log("  Size:       ", Buffer.from(content, "utf-8").length, "bytes");
console.log("");
console.log("Go to: https://dash.cloudflare.com → R2 → " + bucketName);
console.log("Look for object: " + objectKey);
console.log("");
console.log("Once you confirm it exists in the dashboard, tell me to continue.");
