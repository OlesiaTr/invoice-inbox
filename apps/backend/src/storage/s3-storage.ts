import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileStorage } from './file-storage';

export interface S3StorageOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Any S3-compatible object store: AWS S3, or Supabase Storage's S3 endpoint for the demo.
 * Needed as soon as the API and the worker don't share a disk.
 */
export class S3Storage extends FileStorage {
  private readonly client: S3Client;

  constructor(private readonly opts: S3StorageOptions) {
    super();
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      // Supabase (and most non-AWS providers) need path-style URLs.
      forcePathStyle: !!opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
}
