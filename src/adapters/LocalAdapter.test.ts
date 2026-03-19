import { Readable } from 'stream'
import { createFsFromVolume, Volume } from 'memfs'
import { LocalAdapter } from './LocalAdapter'
import { NotFoundError, S3AdaptorError } from '../errors'
import type { LocalConfig } from '../types'

function makeFs(vol: InstanceType<typeof Volume>) {
  return createFsFromVolume(vol) as unknown as typeof import('fs')
}

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

function makeAdapter(config: LocalConfig = BASE_CONFIG, vol = new Volume()) {
  return { adapter: new LocalAdapter(config, makeFs(vol) as never), vol }
}

describe('LocalAdapter', () => {
  describe('putObject / getObject', () => {
    it('stores and retrieves an object', async () => {
      const { adapter } = makeAdapter()
      await adapter.putObject({
        Bucket: 'private',
        Key: 'hello.txt',
        Body: 'world',
        ContentType: 'text/plain',
      })
      const result = await adapter.getObject({ Bucket: 'private', Key: 'hello.txt' })
      expect(result.ContentType).toBe('text/plain')
      const chunks: Buffer[] = []
      for await (const chunk of result.Body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      }
      expect(Buffer.concat(chunks).toString()).toBe('world')
    })

    it('stores buffer body', async () => {
      const { adapter } = makeAdapter()
      await adapter.putObject({ Bucket: 'private', Key: 'buf.bin', Body: Buffer.from([1, 2, 3]) })
      const result = await adapter.getObject({ Bucket: 'private', Key: 'buf.bin' })
      expect(result.ContentLength).toBe(3)
    })

    it('stores stream body', async () => {
      const { adapter } = makeAdapter()
      const stream = Readable.from(Buffer.from('stream-data'))
      await adapter.putObject({ Bucket: 'private', Key: 'streamed.txt', Body: stream })
      const result = await adapter.getObject({ Bucket: 'private', Key: 'streamed.txt' })
      expect(result.ContentLength).toBe(11)
    })

    it('throws NotFoundError for missing key', async () => {
      const { adapter } = makeAdapter()
      await expect(adapter.getObject({ Bucket: 'private', Key: 'missing.txt' })).rejects.toThrow(
        NotFoundError,
      )
    })
  })

  describe('deleteObject', () => {
    it('deletes an existing object', async () => {
      const { adapter } = makeAdapter()
      await adapter.putObject({ Bucket: 'private', Key: 'todelete.txt', Body: 'bye' })
      await adapter.deleteObject({ Bucket: 'private', Key: 'todelete.txt' })
      await expect(adapter.getObject({ Bucket: 'private', Key: 'todelete.txt' })).rejects.toThrow(
        NotFoundError,
      )
    })

    it('throws NotFoundError when deleting missing object', async () => {
      const { adapter } = makeAdapter()
      await expect(adapter.deleteObject({ Bucket: 'private', Key: 'ghost.txt' })).rejects.toThrow(
        NotFoundError,
      )
    })
  })

  describe('listObjects', () => {
    it('lists objects in a bucket', async () => {
      const { adapter } = makeAdapter()
      await adapter.putObject({ Bucket: 'private', Key: 'a.txt', Body: 'a' })
      await adapter.putObject({ Bucket: 'private', Key: 'b.txt', Body: 'b' })
      const result = await adapter.listObjects({ Bucket: 'private' })
      expect(result.Contents.map((c) => c.Key).sort()).toEqual(['a.txt', 'b.txt'])
      expect(result.IsTruncated).toBe(false)
    })

    it('filters by prefix', async () => {
      const { adapter } = makeAdapter()
      await adapter.putObject({ Bucket: 'private', Key: 'images/a.png', Body: 'a' })
      await adapter.putObject({ Bucket: 'private', Key: 'docs/b.pdf', Body: 'b' })
      const result = await adapter.listObjects({ Bucket: 'private', Prefix: 'images/' })
      expect(result.Contents).toHaveLength(1)
      expect(result.Contents[0].Key).toBe('images/a.png')
    })

    it('respects MaxKeys and sets IsTruncated', async () => {
      const { adapter } = makeAdapter()
      await adapter.putObject({ Bucket: 'private', Key: 'a.txt', Body: 'a' })
      await adapter.putObject({ Bucket: 'private', Key: 'b.txt', Body: 'b' })
      await adapter.putObject({ Bucket: 'private', Key: 'c.txt', Body: 'c' })
      const result = await adapter.listObjects({ Bucket: 'private', MaxKeys: 2 })
      expect(result.Contents).toHaveLength(2)
      expect(result.IsTruncated).toBe(true)
    })

    it('returns empty for non-existent bucket', async () => {
      const { adapter } = makeAdapter()
      const result = await adapter.listObjects({ Bucket: 'no-such-bucket' })
      expect(result.Contents).toHaveLength(0)
    })
  })

  describe('getSignedUrl', () => {
    it('returns plain URL for public bucket', async () => {
      const { adapter } = makeAdapter()
      const url = await adapter.getSignedUrl({ Bucket: 'public', Key: 'img.png' })
      expect(url).toBe('http://localhost:3000/files/public/img.png')
      expect(url).not.toContain('token=')
    })

    it('returns token URL for protected bucket', async () => {
      const { adapter } = makeAdapter()
      const url = await adapter.getSignedUrl({ Bucket: 'private', Key: 'doc.pdf' })
      expect(url).toContain('?token=')
      expect(url.startsWith('http://localhost:3000/files/private/doc.pdf?token=')).toBe(true)
    })

    it('uses custom expiry', async () => {
      const { adapter } = makeAdapter()
      const before = Math.floor(Date.now() / 1000)
      const url = await adapter.getSignedUrl({ Bucket: 'private', Key: 'doc.pdf', Expires: 60 })
      const token = url.split('token=')[1]
      const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
      expect(payload.exp).toBeGreaterThanOrEqual(before + 60)
      expect(payload.exp).toBeLessThanOrEqual(before + 61)
    })
  })

  describe('pruneEmptyDirs', () => {
    it('removes empty subdirectories after files are deleted', async () => {
      const vol = new Volume()
      const { adapter } = makeAdapter(BASE_CONFIG, vol)
      await adapter.putObject({ Bucket: 'private', Key: 'proj/survey/abc/file.png', Body: 'x' })
      await adapter.deleteObject({ Bucket: 'private', Key: 'proj/survey/abc/file.png' })
      await adapter.pruneEmptyDirs('private', 'proj')
      const fs = makeFs(vol)
      await expect(fs.promises.access('/storage/private/proj/survey/abc')).rejects.toThrow()
      await expect(fs.promises.access('/storage/private/proj/survey')).rejects.toThrow()
      await expect(fs.promises.access('/storage/private/proj')).rejects.toThrow()
    })

    it('keeps directories that still contain files', async () => {
      const vol = new Volume()
      const { adapter } = makeAdapter(BASE_CONFIG, vol)
      await adapter.putObject({ Bucket: 'private', Key: 'proj/survey/abc/keep.png', Body: 'keep' })
      await adapter.putObject({ Bucket: 'private', Key: 'proj/survey/abc/gone.png', Body: 'gone' })
      await adapter.deleteObject({ Bucket: 'private', Key: 'proj/survey/abc/gone.png' })
      await adapter.pruneEmptyDirs('private', 'proj')
      const fs = makeFs(vol)
      await expect(fs.promises.access('/storage/private/proj/survey/abc')).resolves.toBeUndefined()
    })

    it('does not remove the bucket root', async () => {
      const vol = new Volume()
      const { adapter } = makeAdapter(BASE_CONFIG, vol)
      await adapter.putObject({ Bucket: 'private', Key: 'a.txt', Body: 'x' })
      await adapter.deleteObject({ Bucket: 'private', Key: 'a.txt' })
      await adapter.pruneEmptyDirs('private')
      const fs = makeFs(vol)
      await expect(fs.promises.access('/storage/private')).resolves.toBeUndefined()
    })

    it('no-ops when prefix directory does not exist', async () => {
      const { adapter } = makeAdapter()
      await expect(adapter.pruneEmptyDirs('private', 'nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('security', () => {
    it('rejects path traversal in key', async () => {
      const { adapter } = makeAdapter()
      await expect(
        adapter.putObject({ Bucket: 'private', Key: '../etc/passwd', Body: 'x' }),
      ).rejects.toThrow(S3AdaptorError)
    })

    it('rejects absolute key', async () => {
      const { adapter } = makeAdapter()
      await expect(adapter.getObject({ Bucket: 'private', Key: '/etc/passwd' })).rejects.toThrow(
        S3AdaptorError,
      )
    })

    it('rejects path traversal in bucket', async () => {
      const { adapter } = makeAdapter()
      await expect(adapter.getObject({ Bucket: '../other', Key: 'file.txt' })).rejects.toThrow(
        S3AdaptorError,
      )
    })
  })
})
