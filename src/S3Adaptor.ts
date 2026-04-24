import { InvalidConfigError } from './errors'
import { LocalAdapter } from './adapters/LocalAdapter'
import { S3Adapter } from './adapters/S3Adapter'
import { BaseAdapter } from './adapters/BaseAdapter'
import type {
  CopyObjectParams,
  DeleteObjectParams,
  GetObjectParams,
  GetObjectResult,
  GetSignedUrlParams,
  ListObjectsParams,
  ListObjectsResult,
  PutObjectParams,
  S3AdaptorConfig,
  UploadObjectParams,
} from './types'

function validateConfig(config: S3AdaptorConfig): void {
  if (config.defaultType === 's3' && !config.s3) {
    throw new InvalidConfigError("s3 config required when defaultType is 's3'")
  }
  if (config.defaultType === 'local' && !config.local) {
    throw new InvalidConfigError("local config required when defaultType is 'local'")
  }
  if (config.local && config.local.secretKey.length < 32) {
    throw new InvalidConfigError('secretKey must be at least 32 characters')
  }
}

export class S3Adaptor {
  private readonly adapter: BaseAdapter

  constructor(config: S3AdaptorConfig) {
    validateConfig(config)
    this.adapter =
      config.defaultType === 's3' ? new S3Adapter(config.s3!) : new LocalAdapter(config.local!)
  }

  putObject(params: PutObjectParams): Promise<void> {
    return this.adapter.putObject(params)
  }

  uploadObject(params: UploadObjectParams): Promise<void> {
    return this.adapter.uploadObject(params)
  }

  getObject(params: GetObjectParams): Promise<GetObjectResult> {
    return this.adapter.getObject(params)
  }

  deleteObject(params: DeleteObjectParams): Promise<void> {
    return this.adapter.deleteObject(params)
  }

  copyObject(params: CopyObjectParams): Promise<void> {
    return this.adapter.copyObject(params)
  }

  listObjects(params: ListObjectsParams): Promise<ListObjectsResult> {
    return this.adapter.listObjects(params)
  }

  getSignedUrl(params: GetSignedUrlParams): Promise<string> {
    return this.adapter.getSignedUrl(params)
  }

  pruneEmptyDirs(bucket: string, prefix?: string): Promise<void> {
    return this.adapter.pruneEmptyDirs(bucket, prefix)
  }
}
