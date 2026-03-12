import type {
  DeleteObjectParams,
  GetObjectParams,
  GetObjectResult,
  GetSignedUrlParams,
  ListObjectsParams,
  ListObjectsResult,
  PutObjectParams,
} from '../types'

export abstract class BaseAdapter {
  abstract putObject(params: PutObjectParams): Promise<void>
  abstract getObject(params: GetObjectParams): Promise<GetObjectResult>
  abstract deleteObject(params: DeleteObjectParams): Promise<void>
  abstract listObjects(params: ListObjectsParams): Promise<ListObjectsResult>
  abstract getSignedUrl(params: GetSignedUrlParams): Promise<string>
}
