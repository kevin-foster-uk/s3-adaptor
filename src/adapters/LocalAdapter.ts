import { createHash } from 'crypto'
import * as path from 'path'
import * as realFs from 'fs'
import { Readable } from 'stream'

import { NotFoundError, S3AdaptorError } from '../errors'
import { TokenSigner } from '../signing/TokenSigner'
import type {
  CopyObjectParams,
  DeleteObjectParams,
  GetObjectParams,
  GetObjectResult,
  GetSignedUrlParams,
  ListObjectsParams,
  ListObjectsResult,
  LocalConfig,
  PutObjectParams,
  StoredMetadata,
  UploadObjectParams,
} from '../types'
import { BaseAdapter } from './BaseAdapter'

type FsModule = typeof realFs

function validateKey(key: string): void {
  if (key.startsWith('/') || key.includes('..')) {
    throw new S3AdaptorError('Forbidden key path', 'FORBIDDEN')
  }
}

function validateBucket(bucket: string): void {
  if (bucket.startsWith('/') || bucket.includes('..') || bucket.includes('/')) {
    throw new S3AdaptorError('Forbidden bucket name', 'FORBIDDEN')
  }
}

function metaPath(filePath: string): string {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  return path.join(dir, `.${base}.meta.json`)
}

export class LocalAdapter extends BaseAdapter {
  private readonly signer: TokenSigner

  constructor(
    private readonly config: LocalConfig,
    private readonly fs: FsModule = realFs,
  ) {
    super()
    this.signer = new TokenSigner(config.secretKey)
  }

  private isPublicBucket(bucket: string): boolean {
    return this.config.buckets?.[bucket]?.public ?? false
  }

  private resolveFilePath(bucket: string, key: string): string {
    validateBucket(bucket)
    validateKey(key)
    return path.join(this.config.storagePath, bucket, key)
  }

  uploadObject(params: UploadObjectParams): Promise<void> {
    return this.putObject(params)
  }

  async putObject(params: PutObjectParams): Promise<void> {
    const { Bucket, Key, Body, ContentType, Metadata } = params
    const filePath = this.resolveFilePath(Bucket, Key)
    const dir = path.dirname(filePath)

    await this.fs.promises.mkdir(dir, { recursive: true })

    const bodyBuffer =
      typeof Body === 'string'
        ? Buffer.from(Body)
        : Body instanceof Buffer
          ? Body
          : await streamToBuffer(Body as NodeJS.ReadableStream)

    await this.fs.promises.writeFile(filePath, bodyBuffer)

    const etag = createHash('md5').update(bodyBuffer).digest('hex')
    const meta: StoredMetadata = {
      ContentType,
      Metadata,
      ETag: etag,
      Size: bodyBuffer.length,
      LastModified: new Date().toISOString(),
    }
    await this.fs.promises.writeFile(metaPath(filePath), JSON.stringify(meta))
  }

  async getObject(params: GetObjectParams): Promise<GetObjectResult> {
    const { Bucket, Key } = params
    const filePath = this.resolveFilePath(Bucket, Key)

    try {
      await this.fs.promises.access(filePath)
    } catch {
      throw new NotFoundError(Bucket, Key)
    }

    let meta: StoredMetadata | undefined
    try {
      const raw = await this.fs.promises.readFile(metaPath(filePath), 'utf-8')
      meta = JSON.parse(raw) as StoredMetadata
    } catch {
      // metadata optional
    }

    const fileBuffer = await this.fs.promises.readFile(filePath)
    const body = Readable.from(fileBuffer)

    return {
      Body: body,
      ContentType: meta?.ContentType,
      ContentLength: meta?.Size,
      Metadata: meta?.Metadata,
      ETag: meta?.ETag,
    }
  }

  async copyObject(params: CopyObjectParams): Promise<void> {
    const { Bucket, Key, CopySource, ContentType, Metadata } = params
    // CopySource format: '{sourceBucket}/{sourceKey}'
    const slashIdx = CopySource.indexOf('/')
    const srcBucket = CopySource.slice(0, slashIdx)
    const srcKey = CopySource.slice(slashIdx + 1)

    const srcPath = this.resolveFilePath(srcBucket, srcKey)
    const dstPath = this.resolveFilePath(Bucket, Key)
    await this.fs.promises.mkdir(path.dirname(dstPath), { recursive: true })
    await this.fs.promises.copyFile(srcPath, dstPath)

    let srcMeta: StoredMetadata | undefined
    try {
      const raw = await this.fs.promises.readFile(metaPath(srcPath), 'utf-8')
      srcMeta = JSON.parse(raw) as StoredMetadata
    } catch {
      // sidecar optional
    }

    const newMeta: StoredMetadata = {
      ContentType: ContentType ?? srcMeta?.ContentType,
      Metadata: Metadata ?? srcMeta?.Metadata,
      ETag: srcMeta?.ETag ?? '',
      Size: srcMeta?.Size ?? 0,
      LastModified: new Date().toISOString(),
    }
    await this.fs.promises.writeFile(metaPath(dstPath), JSON.stringify(newMeta))
  }

  async deleteObject(params: DeleteObjectParams): Promise<void> {
    const { Bucket, Key } = params
    const filePath = this.resolveFilePath(Bucket, Key)

    try {
      await this.fs.promises.unlink(filePath)
    } catch {
      throw new NotFoundError(Bucket, Key)
    }

    try {
      await this.fs.promises.unlink(metaPath(filePath))
    } catch {
      // sidecar may not exist
    }
  }

  async listObjects(params: ListObjectsParams): Promise<ListObjectsResult> {
    const { Bucket, Prefix = '', MaxKeys } = params
    validateBucket(Bucket)
    const bucketDir = path.join(this.config.storagePath, Bucket)

    let allFiles: string[]
    try {
      allFiles = await readdirRecursive(bucketDir, this.fs)
    } catch {
      return { Contents: [], IsTruncated: false }
    }

    const metaSuffix = '.meta.json'
    const filtered = allFiles.filter((f) => {
      const rel = path.relative(bucketDir, f).replace(/\\/g, '/')
      const base = path.basename(f)
      return !base.startsWith('.') && !base.endsWith(metaSuffix) && rel.startsWith(Prefix)
    })

    const limited = MaxKeys !== undefined ? filtered.slice(0, MaxKeys) : filtered
    const isTruncated = MaxKeys !== undefined && filtered.length > MaxKeys

    const contents = await Promise.all(
      limited.map(async (f) => {
        const rel = path.relative(bucketDir, f).replace(/\\/g, '/')
        const stat = await this.fs.promises.stat(f)
        let etag: string | undefined
        try {
          const raw = await this.fs.promises.readFile(metaPath(f), 'utf-8')
          const meta = JSON.parse(raw) as StoredMetadata
          etag = meta.ETag
        } catch {
          // no sidecar
        }
        return {
          Key: rel,
          Size: stat.size,
          LastModified: stat.mtime,
          ETag: etag,
        }
      }),
    )

    return { Contents: contents, IsTruncated: isTruncated }
  }

  async pruneEmptyDirs(bucket: string, prefix?: string): Promise<void> {
    validateBucket(bucket)
    const bucketDir = path.join(this.config.storagePath, bucket)
    const targetDir = prefix ? path.join(bucketDir, prefix) : bucketDir

    try {
      await this.fs.promises.access(targetDir)
    } catch {
      return
    }

    await pruneEmptyDirsRecursive(targetDir, bucketDir, this.fs)
  }

  async getSignedUrl(params: GetSignedUrlParams): Promise<string> {
    const { Bucket, Key, Expires, ResponseContentDisposition } = params
    const base = `${this.config.baseUrl}/${Bucket}/${Key}`

    if (this.isPublicBucket(Bucket)) {
      // Public buckets have no token to bind a disposition into - anyone can
      // already request any key in a public bucket under any disposition,
      // signed or not, so this remains a bare query param.
      const dispositionParam = ResponseContentDisposition
        ? `disposition=${encodeURIComponent(ResponseContentDisposition)}`
        : null
      return dispositionParam ? `${base}?${dispositionParam}` : base
    }

    const exp = Math.floor(Date.now() / 1000) + (Expires ?? this.config.defaultExpiry ?? 3600)
    // Bind the disposition into the signature itself, so it can't be changed
    // by editing the query string after the URL is issued.
    const token = this.signer.sign({
      bucket: Bucket,
      key: Key,
      exp,
      disposition: ResponseContentDisposition,
    })
    return `${base}?token=${token}`
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    )
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

async function pruneEmptyDirsRecursive(dir: string, stopAt: string, fs: FsModule): Promise<void> {
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await pruneEmptyDirsRecursive(path.join(dir, entry.name), stopAt, fs)
    }
  }

  if (dir === stopAt) return

  const remaining = await fs.promises.readdir(dir)
  if (remaining.length === 0) {
    try {
      await fs.promises.rmdir(dir)
    } catch {
      // non-empty or concurrent write — leave it
    }
  }
}

async function readdirRecursive(dir: string, fs: FsModule): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = await readdirRecursive(full, fs)
      results.push(...sub)
    } else {
      results.push(full)
    }
  }
  return results
}
