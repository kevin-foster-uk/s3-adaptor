import { S3Adapter } from './S3Adapter'
import { NotFoundError, S3AdaptorError } from '../errors'

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3')
  const mockSend = jest.fn()
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    __mockSend: mockSend,
  }
})

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockSend } = require('@aws-sdk/client-s3') as { __mockSend: jest.Mock }

describe('S3Adapter', () => {
  let adapter: S3Adapter

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new S3Adapter({ region: 'us-east-1' })
  })

  describe('putObject', () => {
    it('sends PutObjectCommand', async () => {
      __mockSend.mockResolvedValueOnce({})
      await adapter.putObject({ Bucket: 'b', Key: 'k', Body: 'data', ContentType: 'text/plain' })
      expect(__mockSend).toHaveBeenCalledTimes(1)
    })

    it('wraps errors', async () => {
      __mockSend.mockRejectedValueOnce(new Error('network error'))
      await expect(adapter.putObject({ Bucket: 'b', Key: 'k', Body: 'data' })).rejects.toThrow(
        S3AdaptorError,
      )
    })
  })

  describe('getObject', () => {
    it('returns normalized result', async () => {
      const fakeBody = { pipe: jest.fn() }
      __mockSend.mockResolvedValueOnce({
        Body: fakeBody,
        ContentType: 'image/png',
        ContentLength: 100,
        ETag: '"abc"',
      })
      const result = await adapter.getObject({ Bucket: 'b', Key: 'k' })
      expect(result.ContentType).toBe('image/png')
      expect(result.ETag).toBe('"abc"')
    })

    it('translates NoSuchKey to NotFoundError', async () => {
      const { NoSuchKey } = jest.requireActual(
        '@aws-sdk/client-s3',
      ) as typeof import('@aws-sdk/client-s3')
      __mockSend.mockRejectedValueOnce(new NoSuchKey({ message: 'no such key', $metadata: {} }))
      await expect(adapter.getObject({ Bucket: 'b', Key: 'missing' })).rejects.toThrow(
        NotFoundError,
      )
    })
  })

  describe('deleteObject', () => {
    it('sends DeleteObjectCommand', async () => {
      __mockSend.mockResolvedValueOnce({})
      await adapter.deleteObject({ Bucket: 'b', Key: 'k' })
      expect(__mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('listObjects', () => {
    it('returns normalized list', async () => {
      __mockSend.mockResolvedValueOnce({
        Contents: [{ Key: 'a.txt', Size: 10, LastModified: new Date('2024-01-01'), ETag: '"e"' }],
        IsTruncated: false,
      })
      const result = await adapter.listObjects({ Bucket: 'b' })
      expect(result.Contents).toHaveLength(1)
      expect(result.Contents[0].Key).toBe('a.txt')
    })

    it('handles empty response', async () => {
      __mockSend.mockResolvedValueOnce({ Contents: undefined, IsTruncated: false })
      const result = await adapter.listObjects({ Bucket: 'b' })
      expect(result.Contents).toHaveLength(0)
    })
  })

  describe('getSignedUrl', () => {
    it('returns signed URL from SDK', async () => {
      const url = await adapter.getSignedUrl({ Bucket: 'b', Key: 'k', Expires: 300 })
      expect(url).toBe('https://s3.example.com/signed-url')
    })
  })
})
