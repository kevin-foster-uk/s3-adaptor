import type {
  CopyObjectParams,
  DeleteObjectParams,
  GetObjectParams,
  GetObjectResult,
  GetSignedUrlParams,
  ListObjectsParams,
  ListObjectsResult,
  PutObjectParams,
  UploadObjectParams,
} from '../types'

export abstract class BaseAdapter {
  abstract putObject(params: PutObjectParams): Promise<void>
  abstract uploadObject(params: UploadObjectParams): Promise<void>
  abstract getObject(params: GetObjectParams): Promise<GetObjectResult>
  abstract deleteObject(params: DeleteObjectParams): Promise<void>
  abstract copyObject(params: CopyObjectParams): Promise<void>
  abstract listObjects(params: ListObjectsParams): Promise<ListObjectsResult>
  abstract getSignedUrl(params: GetSignedUrlParams): Promise<string>

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pruneEmptyDirs(_bucket: string, _prefix?: string): Promise<void> {
    return Promise.resolve()
  }
}
