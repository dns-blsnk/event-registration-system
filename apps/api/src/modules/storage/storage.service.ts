import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BANNER_MAX_BYTES, BANNER_MIME_TYPES, ErrorCode, type BannerMimeType } from '@ers/shared';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { fieldError } from '../../common/errors/field-error.js';
import { MINUTE_MS, SECOND_MS } from '../../common/time.js';
import { InjectConfig } from '../../config/config.module.js';

import { detectImageType } from './image-type.js';

import type { Config } from '../../config/config.schema.js';

const PRESIGNED_URL_TTL_MINUTES = 15;

/** How long a presigned download link stays valid. */
export const PRESIGNED_URL_TTL_SECONDS = (PRESIGNED_URL_TTL_MINUTES * MINUTE_MS) / SECOND_MS;

/**
 * Object storage behind one S3-compatible client: SeaweedFS locally and in CI, Cloudflare R2 in
 * production. Objects stay private; readers get short-lived presigned links.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@InjectConfig() config: Config) {
    const { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle } = config.s3;
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
      // Cloudflare R2 rejects the newer default checksum headers; send them only when S3 requires.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  /**
   * Stores an image. The only way to write: the type comes from the bytes (magic numbers) and the
   * size is capped here, so no caller can store HTML or SVG that a presigned link would render.
   */
  async putImage(key: string, body: Uint8Array): Promise<BannerMimeType> {
    if (body.byteLength > BANNER_MAX_BYTES) {
      throw new DomainError(
        ErrorCode.PAYLOAD_TOO_LARGE,
        `The image must be at most ${String(BANNER_MAX_BYTES)} bytes`,
      );
    }
    const contentType = detectImageType(body);
    if (contentType === undefined) {
      throw fieldError('file', `The image must be one of: ${BANNER_MIME_TYPES.join(', ')}`);
    }
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return contentType;
  }

  /** Deleting a missing key succeeds (S3 semantics), so cleanup can be retried safely. */
  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async presignedGetUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });
  }
}
