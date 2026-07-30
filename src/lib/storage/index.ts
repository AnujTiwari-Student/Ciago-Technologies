// Storage abstraction layer — single entry point for all file operations
// Direct cutover: R2 only, no fallback

import { R2StorageAdapter } from "./r2";
import type { StorageAdapter } from "./types";

let _storage: StorageAdapter | undefined;

/**
 * Get the active storage adapter (R2).
 * Singleton instance created on first call.
 */
export function getStorage(): StorageAdapter {
  if (!_storage) {
    _storage = new R2StorageAdapter();
  }
  return _storage;
}

export type { StorageAdapter, SignedUrlResult, UploadResult, DeleteResult } from "./types";
