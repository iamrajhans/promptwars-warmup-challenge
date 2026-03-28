/**
 * Google Cloud Storage Service
 * Uploads files to GCS when configured, falls back to local base64 storage.
 */

export interface UploadResult {
  uri: string;
  publicUrl: string; // Add publicUrl for frontend rendering
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedLocally: boolean;
}

// Local fallback store for when GCS credentials aren't available
const globalAny: any = global;
if (!globalAny.__localFileStore) {
  globalAny.__localFileStore = new Map<string, string>();
}
const localStore: Map<string, string> = globalAny.__localFileStore;

/**
 * Upload a file buffer to Google Cloud Storage or local fallback.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const bucketName = process.env.GCS_BUCKET_NAME;

  // If GCS is configured, use it
  if (bucketName && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage();
      const bucket = storage.bucket(bucketName);

      const datePrefix = new Date().toISOString().split('T')[0];
      const gcsPath = `uploads/${datePrefix}/${filename}-${Date.now()}`;
      const file = bucket.file(gcsPath);

      await file.save(buffer, {
        metadata: { contentType: mimeType },
        resumable: false,
      });

      // Generate a Signed URL for the frontend (valid for 1 hour)
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      return {
        uri: `gs://${bucketName}/${gcsPath}`,
        publicUrl: signedUrl,
        originalName: filename,
        mimeType,
        sizeBytes: buffer.length,
        storedLocally: false,
      };
    } catch (error) {
      console.error('[GCS] Upload failed, falling back to local storage:', error);
    }
  }

  // Local fallback: store base64 in memory
  const localId = `local_${Date.now()}_${filename}`;
  const base64 = buffer.toString('base64');
  localStore.set(localId, base64);
  
  // Create a data URI for direct browser rendering
  const dataUrl = `data:${mimeType};base64,${base64}`;

  console.info(`[Storage] File stored locally as ${localId} (${buffer.length} bytes). Configure GCS_BUCKET_NAME for cloud storage.`);

  return {
    uri: `local://${localId}`,
    publicUrl: dataUrl,
    originalName: filename,
    mimeType,
    sizeBytes: buffer.length,
    storedLocally: true,
  };
}

/**
 * Retrieve a locally stored file's base64 content.
 */
export function getLocalFile(localId: string): string | undefined {
  return localStore.get(localId);
}
