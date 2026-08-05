// Storage abstraction types for Cloudflare R2 migration
// Provides a common interface that works with both Supabase Storage and R2

export type SignedUrlResult =
  | { signedUrl: string; error: null }
  | { signedUrl: null; error: string };

export type UploadResult = { path: string; error: null } | { path: null; error: string };

export type DeleteResult = { success: true; error: null } | { success: false; error: string };

/**
 * Storage interface abstraction.
 * Implementations: R2StorageAdapter, SupabaseStorageAdapter (legacy fallback)
 */
export interface StorageAdapter {
  /**
   * Generate a signed URL for reading a private file.
   * @param bucket - Bucket name (e.g., "resumes", "avatars")
   * @param path - File path within the bucket
   * @param expiresIn - Expiry in seconds
   */
  createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<SignedUrlResult>;

  /**
   * Upload a file to storage.
   * @param bucket - Bucket name
   * @param path - Destination path
   * @param file - File buffer or stream
   * @param contentType - MIME type
   */
  upload(
    bucket: string,
    path: string,
    file: Buffer | ReadableStream,
    contentType?: string,
  ): Promise<UploadResult>;

  /**
   * Delete file(s) from storage.
   * @param bucket - Bucket name
   * @param paths - Array of file paths to delete
   */
  remove(bucket: string, paths: string[]): Promise<DeleteResult>;
}
