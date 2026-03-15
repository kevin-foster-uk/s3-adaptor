import { createReadStream } from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import type { RequestHandler } from 'express'
import {
  AccessDeniedError,
  InvalidTokenError,
  NotFoundError,
  S3AdaptorError,
  TokenExpiredError,
} from '../errors'
import { TokenSigner } from '../signing/TokenSigner'
import type { LocalConfig, StoredMetadata } from '../types'

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

function resolveFilePath(storagePath: string, bucket: string, key: string): string {
  validateBucket(bucket)
  validateKey(key)
  return path.join(storagePath, bucket, key)
}

function metaPath(filePath: string): string {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  return path.join(dir, `.${base}.meta.json`)
}

async function readMetadata(filePath: string): Promise<StoredMetadata | undefined> {
  try {
    const raw = await fsPromises.readFile(metaPath(filePath), 'utf-8')
    return JSON.parse(raw) as StoredMetadata
  } catch {
    return undefined
  }
}

export function createLocalFileMiddleware(config: LocalConfig): RequestHandler {
  const signer = new TokenSigner(config.secretKey)

  return async (req, res, next) => {
    try {
      const bucket = req.params['bucket']
      // Express wildcard: params[0] when mounted as /:bucket/*
      const key = (req.params as Record<string, string>)['0'] ?? req.params['key'] ?? ''

      if (!bucket) {
        res.status(400).json({ error: 'Missing bucket' })
        return
      }

      const isPublic = config.buckets?.[bucket]?.public ?? false

      if (!isPublic) {
        const token = req.query['token'] as string | undefined
        if (!token) throw new AccessDeniedError()
        const claims = signer.verify(token)
        if (claims.bucket !== bucket || claims.key !== key) throw new InvalidTokenError()
      }

      const filePath = resolveFilePath(config.storagePath, bucket, key)

      try {
        await fsPromises.access(filePath)
      } catch {
        throw new NotFoundError(bucket, key)
      }

      const meta = await readMetadata(filePath)
      res.setHeader('Content-Type', meta?.ContentType ?? 'application/octet-stream')
      if (meta?.Size !== undefined) res.setHeader('Content-Length', meta.Size)
      if (meta?.ETag) res.setHeader('ETag', meta.ETag)
      const disposition = req.query['disposition']
      if (typeof disposition === 'string') res.setHeader('Content-Disposition', disposition)

      createReadStream(filePath).pipe(res)
    } catch (err) {
      if (
        err instanceof AccessDeniedError ||
        err instanceof TokenExpiredError ||
        err instanceof InvalidTokenError
      ) {
        res.status(403).json({ error: (err as Error).message })
      } else if (err instanceof NotFoundError) {
        res.status(404).json({ error: (err as Error).message })
      } else {
        next(err)
      }
    }
  }
}
