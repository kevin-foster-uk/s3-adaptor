export interface BucketPolicy {
  public: boolean
}

export interface LocalConfig {
  storagePath: string
  baseUrl: string
  secretKey: string
  defaultExpiry?: number
  buckets?: Record<string, BucketPolicy>
}

export interface S3AdaptorConfig {
  defaultType: 's3' | 'local'
  s3?: {
    region: string
    credentials?: { accessKeyId: string; secretAccessKey: string }
    endpoint?: string
  }
  local?: LocalConfig
}

export interface PutObjectParams {
  Bucket: string
  Key: string
  Body: Buffer | NodeJS.ReadableStream | string
  ContentType?: string
  Metadata?: Record<string, string>
}

export interface GetObjectParams {
  Bucket: string
  Key: string
}

export interface DeleteObjectParams {
  Bucket: string
  Key: string
}

export interface ListObjectsParams {
  Bucket: string
  Prefix?: string
  MaxKeys?: number
}

export interface GetSignedUrlParams {
  Bucket: string
  Key: string
  Expires?: number
  ResponseContentDisposition?: string
}

export interface GetObjectResult {
  Body: NodeJS.ReadableStream
  ContentType?: string
  ContentLength?: number
  Metadata?: Record<string, string>
  ETag?: string
}

export interface ListObjectsResult {
  Contents: Array<{ Key: string; Size: number; LastModified: Date; ETag?: string }>
  IsTruncated: boolean
}

export interface StoredMetadata {
  ContentType?: string
  Metadata?: Record<string, string>
  ETag: string
  Size: number
  LastModified: string
}
