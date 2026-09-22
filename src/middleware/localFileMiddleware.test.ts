import * as path from 'path'
import { PassThrough } from 'stream'
import { createFsFromVolume, Volume } from 'memfs'
import { createLocalFileMiddleware } from './localFileMiddleware'
import { TokenSigner } from '../signing/TokenSigner'
import type { LocalConfig } from '../types'

// Shared volume - populated/reset per test
const vol = new Volume()
const memfsInstance = createFsFromVolume(vol)

jest.mock('fs', () => {
  const { createFsFromVolume, Volume } = jest.requireActual('memfs') as typeof import('memfs')
  const sharedVol = new Volume()
  ;(global as Record<string, unknown>)['__testVol__'] = sharedVol
  const mfs = createFsFromVolume(sharedVol)
  return {
    ...mfs,
    promises: mfs.promises,
    createReadStream: mfs.createReadStream.bind(mfs),
  }
})

const SECRET = 'supersecretkey-atleast-32-chars!!'

const BASE_CONFIG: LocalConfig = {
  storagePath: '/storage',
  baseUrl: 'http://localhost:3000/files',
  secretKey: SECRET,
  defaultExpiry: 3600,
  buckets: {
    public: { public: true },
    private: { public: false },
  },
}

function getVol(): InstanceType<typeof Volume> {
  return (global as Record<string, unknown>)['__testVol__'] as InstanceType<typeof Volume>
}

interface TestResponse {
  res: ReturnType<typeof makeRes>
  done: Promise<{ status: number; json?: unknown }>
  getStatus: () => number
  getJson: () => unknown
  headers: Record<string, string | number>
}

function makeRes(): TestResponse {
  let settled = false
  let settle!: (v: { status: number; json?: unknown }) => void
  const done = new Promise<{ status: number; json?: unknown }>((r) => {
    settle = r
  })

  let status = 200
  const headers: Record<string, string | number> = {}
  let jsonBody: unknown

  // Use PassThrough so createReadStream(...).pipe(res) works properly
  const body = new PassThrough()

  const res = Object.assign(body, {
    setHeader: (k: string, v: string | number) => {
      headers[k] = v
    },
    status: (code: number) => {
      status = code
      return res
    },
    json: (data: unknown) => {
      jsonBody = data
      if (!settled) {
        settled = true
        settle({ status, json: data })
      }
    },
  }) as unknown as TestResponse['res']

  body.on('finish', () => {
    if (!settled) {
      settled = true
      settle({ status })
    }
  })

  body.on('error', () => {
    if (!settled) {
      settled = true
      settle({ status })
    }
  })

  return {
    res,
    done,
    getStatus: () => status,
    getJson: () => jsonBody,
    headers,
  }
}

function makeReq(
  bucket: string,
  key: string,
  token?: string,
  extraQuery?: Record<string, string>,
) {
  return {
    params: { bucket, '0': key } as Record<string, string>,
    query: {
      ...(token ? { token } : {}),
      ...extraQuery,
    } as Record<string, string>,
  } as never
}

async function writeTestFile(
  testVol: InstanceType<typeof Volume>,
  bucket: string,
  key: string,
  content: string,
  contentType = 'text/plain',
): Promise<void> {
  const dir = path.join('/storage', bucket, path.dirname(key))
  testVol.mkdirSync(dir, { recursive: true })
  const filePath = path.join('/storage', bucket, key)
  testVol.writeFileSync(filePath, content)
  const metaFile = path.join(path.dirname(filePath), `.${path.basename(filePath)}.meta.json`)
  testVol.writeFileSync(
    metaFile,
    JSON.stringify({
      ContentType: contentType,
      ETag: 'etag',
      Size: content.length,
      LastModified: new Date().toISOString(),
    }),
  )
}

function makeSignedToken(
  bucket: string,
  key: string,
  expiresIn = 3600,
  disposition?: string,
): string {
  const signer = new TokenSigner(SECRET)
  const exp = Math.floor(Date.now() / 1000) + expiresIn
  return signer.sign({ bucket, key, exp, disposition })
}

// Ignore unhandled stream errors from memfs resets
process.on('uncaughtException', () => {})

describe('localFileMiddleware', () => {
  let testVol: InstanceType<typeof Volume>

  beforeEach(() => {
    testVol = getVol()
    testVol.reset()
  })

  describe('public bucket', () => {
    it('serves file without token', async () => {
      await writeTestFile(testVol, 'public', 'img.png', 'image-data', 'image/png')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done, headers, getStatus } = makeRes()
      const req = makeReq('public', 'img.png')
      handler(req, res as never, () => {})
      await done
      expect(getStatus()).toBe(200)
      expect(headers['Content-Type']).toBe('image/png')
    })

    it('serves file even with invalid/malformed token (token ignored for public)', async () => {
      await writeTestFile(testVol, 'public', 'img.png', 'image-data', 'image/png')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done, getStatus } = makeRes()
      const req = makeReq('public', 'img.png', 'bad-token')
      handler(req, res as never, () => {})
      await done
      expect(getStatus()).toBe(200)
    })
  })

  describe('protected bucket', () => {
    it('returns 403 when no token provided', async () => {
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done } = makeRes()
      const req = makeReq('private', 'doc.pdf')
      handler(req, res as never, () => {})
      const result = await done
      expect(result.status).toBe(403)
      expect(result.json).toMatchObject({ error: 'Access denied' })
    })

    it('returns 403 for expired token', async () => {
      const token = makeSignedToken('private', 'doc.pdf', -10)
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done } = makeRes()
      const req = makeReq('private', 'doc.pdf', token)
      handler(req, res as never, () => {})
      const result = await done
      expect(result.status).toBe(403)
      expect(result.json).toMatchObject({ error: 'Token has expired' })
    })

    it('returns 403 for token with wrong key', async () => {
      const token = makeSignedToken('private', 'other.pdf')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done } = makeRes()
      const req = makeReq('private', 'doc.pdf', token)
      handler(req, res as never, () => {})
      const result = await done
      expect(result.status).toBe(403)
      expect(result.json).toMatchObject({ error: 'Invalid token' })
    })

    it('returns 403 for token with wrong bucket', async () => {
      const token = makeSignedToken('other-bucket', 'doc.pdf')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done } = makeRes()
      const req = makeReq('private', 'doc.pdf', token)
      handler(req, res as never, () => {})
      const result = await done
      expect(result.status).toBe(403)
      expect(result.json).toMatchObject({ error: 'Invalid token' })
    })

    it('serves file with valid token', async () => {
      await writeTestFile(testVol, 'private', 'doc.pdf', 'pdf-data', 'application/pdf')
      const token = makeSignedToken('private', 'doc.pdf')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done, headers, getStatus } = makeRes()
      const req = makeReq('private', 'doc.pdf', token)
      handler(req, res as never, () => {})
      await done
      expect(getStatus()).toBe(200)
      expect(headers['Content-Type']).toBe('application/pdf')
    })

    it('returns 404 for missing file with valid token', async () => {
      const token = makeSignedToken('private', 'missing.txt')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done } = makeRes()
      const req = makeReq('private', 'missing.txt', token)
      handler(req, res as never, () => {})
      const result = await done
      expect(result.status).toBe(404)
    })

    it('serves the disposition the URL was signed with', async () => {
      await writeTestFile(testVol, 'private', 'doc.pdf', 'pdf-data', 'application/pdf')
      const token = makeSignedToken('private', 'doc.pdf', 3600, 'attachment; filename="doc.pdf"')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done, headers, getStatus } = makeRes()
      const req = makeReq('private', 'doc.pdf', token)
      handler(req, res as never, () => {})
      await done
      expect(getStatus()).toBe(200)
      expect(headers['Content-Disposition']).toBe('attachment; filename="doc.pdf"')
    })

    it('ignores a disposition query param tampered with after signing - the signed disposition wins', async () => {
      await writeTestFile(testVol, 'private', 'doc.pdf', 'pdf-data', 'application/pdf')
      const token = makeSignedToken('private', 'doc.pdf', 3600, 'attachment; filename="doc.pdf"')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done, headers, getStatus } = makeRes()
      const req = makeReq('private', 'doc.pdf', token, { disposition: 'inline' })
      handler(req, res as never, () => {})
      await done
      expect(getStatus()).toBe(200)
      expect(headers['Content-Disposition']).toBe('attachment; filename="doc.pdf"')
      expect(headers['Content-Disposition']).not.toBe('inline')
    })

    it('sets no Content-Disposition header when the URL was signed without one, even if the query string supplies one', async () => {
      await writeTestFile(testVol, 'private', 'doc.pdf', 'pdf-data', 'application/pdf')
      const token = makeSignedToken('private', 'doc.pdf')
      const handler = createLocalFileMiddleware(BASE_CONFIG)
      const { res, done, headers, getStatus } = makeRes()
      const req = makeReq('private', 'doc.pdf', token, { disposition: 'inline' })
      handler(req, res as never, () => {})
      await done
      expect(getStatus()).toBe(200)
      expect(headers['Content-Disposition']).toBeUndefined()
    })
  })
})

// Re-export unused vars to suppress TS errors in memfs import
void memfsInstance
void vol
