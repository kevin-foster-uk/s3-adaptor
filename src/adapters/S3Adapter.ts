import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NotFoundError, S3AdaptorError } from '../errors'
import type {
  DeleteObjectParams,
  GetObjectParams,
  GetObjectResult,
  GetSignedUrlParams,
  ListObjectsParams,
  ListObjectsResult,
  PutObjectParams,
} from '../types'
import { BaseAdapter } from './BaseAdapter'

interface S3Config {
  region: string
  credentials?: { accessKeyId: string; secretAccessKey: string }
  endpoint?: string
}

export class S3Adapter extends BaseAdapter {
  private readonly client: S3Client

  constructor(config: S3Config) {
    super()
    this.client = new S3Client({
      region: config.region,
      credentials: config.credentials,
      endpoint: config.endpoint,
    })
  }

  async putObject(params: PutObjectParams): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: params.Bucket,
          Key: params.Key,
          Body: params.Body as never,
          ContentType: params.ContentType,
          Metadata: params.Metadata,
        }),
      )
    } catch (err) {
      throw wrapError(err)
    }
  }

  async getObject(params: GetObjectParams): Promise<GetObjectResult> {
    try {
      const result = await this.client.send(new GetObjectCommand(params))
      const body = result.Body
      if (!body) throw new S3AdaptorError('Empty response body', 'EMPTY_BODY')

      return {
        Body: body as unknown as NodeJS.ReadableStream,
        ContentType: result.ContentType,
        ContentLength: result.ContentLength,
        Metadata: result.Metadata,
        ETag: result.ETag,
      }
    } catch (err) {
      if (err instanceof NoSuchKey) throw new NotFoundError(params.Bucket, params.Key)
      throw wrapError(err)
    }
  }

  async deleteObject(params: DeleteObjectParams): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand(params))
    } catch (err) {
      throw wrapError(err)
    }
  }

  async listObjects(params: ListObjectsParams): Promise<ListObjectsResult> {
    try {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: params.Bucket,
          Prefix: params.Prefix,
          MaxKeys: params.MaxKeys,
        }),
      )
      return {
        Contents: (result.Contents ?? []).map((item) => ({
          Key: item.Key ?? '',
          Size: item.Size ?? 0,
          LastModified: item.LastModified ?? new Date(),
          ETag: item.ETag,
        })),
        IsTruncated: result.IsTruncated ?? false,
      }
    } catch (err) {
      throw wrapError(err)
    }
  }

  async getSignedUrl(params: GetSignedUrlParams): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: params.Bucket,
      Key: params.Key,
      ResponseContentDisposition: params.ResponseContentDisposition,
    })
    return getSignedUrl(this.client, cmd, { expiresIn: params.Expires ?? 3600 })
  }
}

function wrapError(err: unknown): Error {
  if (err instanceof S3AdaptorError) return err
  if (err instanceof Error) return new S3AdaptorError(err.message, 'S3_ERROR')
  return new S3AdaptorError(String(err), 'S3_ERROR')
}
