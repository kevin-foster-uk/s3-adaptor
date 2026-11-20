import * as path from 'path'
import type { Readable } from 'stream'
import type { Volume } from 'memfs'
import { createLocalFileHandler } from './localFileHandler'
import type { LocalFileRequest, LocalFileResponse } from './localFileHandler'
import { TokenSigner } from '../signing/TokenSigner'
import type { LocalConfig } from '../types'

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

const CONFIG: LocalConfig = {
  storagePath: '/storage',
  baseUrl: 'http://localhost:3000/files',
  secretKey: SECRET,
  defaultExpiry: 3600,
  buckets: { public: { public: true }, private: { public: false } },
}

function getVol(): InstanceType<typeof Volume> {
  return (global as Record<string, unknown>)['__testVol__'] as InstanceType<typeof Volume>
}

function writeTestFile(
  bucket: string,
  key: string,
  content: string,
  contentType = 'text/plain',
): void {
  const vol = getVol()
  const filePath = path.join('/storage', bucket, key)
  vol.mkdirSync(path.dirname(filePath), { recursive: true })
  vol.writeFileSync(filePath, content)
  vol.writeFileSync(
    path.join(path.dirname(filePath), `.${path.basename(filePath)}.meta.json`),
    JSON.stringify({ ContentType: contentType, ETag: 'etag-1', Size: content.length }),
  )
}

function token(bucket: string, key: string, disposition?: string): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  return new TokenSigner(SECRET).sign({ bucket, key, exp, disposition })
}

interface Outcome {
  status: number
  json?: unknown
  headers: Record<string, string>
  body: string
  next: unknown[]
}

async function run(
  params: LocalFileRequest['params'],
  query: LocalFileRequest['query'] = {},
): Promise<Outcome> {
  const outcome: Outcome = { status: 200, headers: {}, body: '', next: [] }
  const res: LocalFileResponse = {
    status: (code) => {
      outcome.status = code
      return {
        json: (body) => {
          outcome.json = body
        },
      }
    },
    header: (name, value) => {
      outcome.headers[name] = value
    },
    stream: async (readable: Readable) => {
      for await (const chunk of readable) outcome.body += String(chunk)
    },
  }
  await createLocalFileHandler(CONFIG)({ params, query }, res, (err) => outcome.next.push(err))
  return outcome
}

describe('createLocalFileHandler', () => {
  beforeEach(() => {
    getVol().reset()
  })

  it('streams a public file with its stored type, size and etag', async () => {
    writeTestFile('public', 'img.png', 'image-data', 'image/png')

    const out = await run({ bucket: 'public', key: 'img.png' })

    expect(out.body).toBe('image-data')
    expect(out.headers).toMatchObject({
      'Content-Type': 'image/png',
      'Content-Length': '10',
      ETag: 'etag-1',
    })
  })

  it('takes a nested key as one string or as an array of segments', async () => {
    writeTestFile('public', 'a/b/c.txt', 'nested')

    const asString = await run({ bucket: 'public', key: 'a/b/c.txt' })
    const asArray = await run({ bucket: 'public', key: ['a', 'b', 'c.txt'] })

    expect(asString.body).toBe('nested')
    expect(asArray.body).toBe('nested')
  })

  it('refuses a private file without a token', async () => {
    writeTestFile('private', 'x.txt', 'secret')

    const out = await run({ bucket: 'private', key: 'x.txt' })

    expect(out.status).toBe(403)
    expect(out.body).toBe('')
  })

  it('serves a private file for a valid token and applies its disposition', async () => {
    writeTestFile('private', 'x.txt', 'secret')

    const out = await run(
      { bucket: 'private', key: 'x.txt' },
      { token: token('private', 'x.txt', 'attachment; filename="x.txt"') },
    )

    expect(out.body).toBe('secret')
    expect(out.headers['Content-Disposition']).toBe('attachment; filename="x.txt"')
  })

  it('refuses a token signed for another key', async () => {
    writeTestFile('private', 'x.txt', 'secret')

    const out = await run({ bucket: 'private', key: 'x.txt' }, { token: token('private', 'y.txt') })

    expect(out.status).toBe(403)
  })

  it('answers 404 for a missing file and 400 for a missing bucket', async () => {
    expect((await run({ bucket: 'public', key: 'none.txt' })).status).toBe(404)
    expect((await run({ key: 'none.txt' })).status).toBe(400)
  })

  it('does not serve a path that escapes the bucket', async () => {
    const out = await run({ bucket: 'public', key: '../private/x.txt' })

    expect(out.body).toBe('')
    expect(out.next).toHaveLength(1)
  })
})
