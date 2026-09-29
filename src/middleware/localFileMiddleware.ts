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

type RouteParams = Record<string, string | string[] | undefined>

/**
 * Object key from the route wildcard. Express 5 mounts as `/:bucket/*key` and
 * yields the path segments as an array; Express 4 mounts as `/:bucket/*` and
 * yields the remainder as `params[0]`.
 */
function extractKey(params: RouteParams): string {
  const wildcard = params['key'] ?? params['0'] ?? ''
  return Array.isArray(wildcard) ? wildcard.join('/') : wildcard
}

export function createLocalFileMiddleware(config: LocalConfig): RequestHandler {
  const signer = new TokenSigner(config.secretKey)

  return async (req, res, next) => {
    try {
      const bucket = req.params['bucket']
      const key = extractKey(req.params)

      if (typeof bucket !== 'string' || !bucket) {
        res.status(400).json({ error: 'Missing bucket' })
        return
      }

      const isPublic = config.buckets?.[bucket]?.public ?? false

      // Signed (private-bucket) disposition comes from the verified token,
      // never the raw query string - otherwise a caller could edit the
      // query string to override the disposition the URL was signed with
      // (e.g. turning a deliberately-forced "attachment" into "inline"),
      // since the query string carries no signature of its own. Public
      // buckets have no token to bind it to, so they keep the bare param.
      let disposition: string | undefined
      if (!isPublic) {
        const token = req.query['token'] as string | undefined
        if (!token) throw new AccessDeniedError()
        const claims = signer.verify(token)
        if (claims.bucket !== bucket || claims.key !== key) throw new InvalidTokenError()
        disposition = claims.disposition
      } else {
        const queryDisposition = req.query['disposition']
        disposition = typeof queryDisposition === 'string' ? queryDisposition : undefined
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
      if (disposition) res.setHeader('Content-Disposition', disposition)

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
