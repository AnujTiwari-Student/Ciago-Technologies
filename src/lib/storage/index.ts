// Storage abstraction layer — single entry point for all file operations
// Direct cutover: R2 only, no fallback

import type { StorageAdapter } from "./types";

let _storage: StorageAdapter | undefined;

/**
 * Get the active storage adapter (R2).
 * Uses dynamic import to avoid loading @aws-sdk at module parse time
 * (which crashes Cloudflare Workers due to node:https dependency).
 */
export async function getStorage(): Promise<StorageAdapter> {
  if (!_storage) {
    const { R2StorageAdapter } = await import("./r2");
    _storage = new R2StorageAdapter();
  }
  return _storage;
}

export type { StorageAdapter, SignedUrlResult, UploadResult, DeleteResult } from "./types";
