/**
 * StorageAdapter
 * Pluggable file-storage backend for uploaded images. Exactly one adapter is active
 * at runtime, selected by STORAGE_DRIVER (see storage.module.ts). Every adapter must
 * preserve the same public contract the uploads API has always returned, regardless
 * of where the bytes actually end up.
 */
export interface StoredFile {
  /** Publicly resolvable URL the client can use directly (e.g. in an <img src>). */
  url: string;
  /** Backend-specific identifier for the stored object (local filename, or S3 key). */
  key: string;
}

export interface UploadRequestContext {
  /** Request protocol/host, used by the local adapter to build an absolute URL
   *  (http://localhost:3002/uploads/<file>), matching existing stored records. */
  protocol: string;
  host: string;
}

export interface StorageAdapter {
  /**
   * Persist the given file buffer and return where it can be retrieved from.
   * Implementations must not trust the caller-supplied original filename for
   * anything other than deriving an extension - the stored key is always
   * generated server-side.
   */
  save(file: Express.Multer.File, ctx: UploadRequestContext): Promise<StoredFile>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
