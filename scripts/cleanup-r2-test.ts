/**
 * Delete the test object from R2
 */

import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const accountId = process.env["R2_ACCOUNT_ID"];
const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
const endpoint = process.env["R2_ENDPOINT"];
const bucketName = process.env["R2_BUCKET_NAME"];

if (!accountId || !accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
  console.error("ERROR: Missing R2 environment variables");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

console.log("\n========================================");
console.log("R2 CLEANUP");
console.log("========================================\n");

// List all objects
console.log("Listing all objects in bucket...");
const listCommand = new ListObjectsV2Command({
  Bucket: bucketName,
  MaxKeys: 100,
});
const listResult = await client.send(listCommand);

console.log(`Found ${listResult.KeyCount} objects\n`);

if (listResult.Contents && listResult.Contents.length > 0) {
  for (const obj of listResult.Contents) {
    console.log(`Deleting: ${obj.Key}`);
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: obj.Key,
    });
    await client.send(deleteCommand);
    console.log(`✓ Deleted: ${obj.Key}\n`);
  }
} else {
  console.log("✓ Bucket already empty\n");
}

console.log("========================================");
console.log("✅ R2 CLEANUP COMPLETE");
console.log("========================================\n");
