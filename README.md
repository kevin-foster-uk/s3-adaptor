# s3-adaptor

Unified adapter-pattern interface for AWS S3 and local filesystem storage. Switch backends via config — same API in dev and production. Includes signed URL generation and Express middleware for local dev serving.

## Install

```bash
pnpm add s3-adaptor
# peer dep for middleware:
pnpm add express
```

## Quick Start

**Local (dev)**

```typescript
import { S3Adaptor } from 's3-adaptor'

const storage = new S3Adaptor({
  defaultType: 'local',
  local: {
    storagePath: '/tmp/storage',
    baseUrl: 'http://localhost:3000/files',
    secretKey: 'supersecretkey-atleast-32-chars!',
    buckets: {
      avatars: { public: true },  // no token required to read
      docs:    { public: false }, // token required (default)
    },
  },
})
```

**S3 (production)**

```typescript
const storage = new S3Adaptor({
  defaultType: 's3',
  s3: { region: 'us-east-1' }, // uses AWS SDK default credential chain
})
```

## API

```typescript
// Upload
await storage.putObject({ Bucket, Key, Body, ContentType?, Metadata? })

// Download — returns { Body: ReadableStream, ContentType?, ContentLength?, ETag?, Metadata? }
const result = await storage.getObject({ Bucket, Key })

// Delete
await storage.deleteObject({ Bucket, Key })

// List — returns { Contents: [{ Key, Size, LastModified, ETag? }], IsTruncated }
const list = await storage.listObjects({ Bucket, Prefix?, MaxKeys? })

// Signed URL — public bucket → plain URL; protected → ?token=<signed> (local); S3 → pre-signed
const url = await storage.getSignedUrl({ Bucket, Key, Expires? })
```

## Express Middleware (local only)

```typescript
import { createLocalFileMiddleware } from 's3-adaptor'

// Mount as: GET /files/:bucket/*
app.get('/files/:bucket/*', createLocalFileMiddleware(config.local))
```

Access control is based on bucket policy:
- Public bucket: serves file without token
- Protected bucket: requires `?token=<signed>` obtained from `getSignedUrl`

## Bucket Access Modes

| Mode      | `BucketPolicy.public` | `getSignedUrl` result   | Middleware            |
|-----------|-----------------------|-------------------------|-----------------------|
| Public    | `true`                | plain URL, no token     | serves without token  |
| Protected | `false` (default)     | URL with `?token=<...>` | requires valid token  |

## Error Classes

All errors extend `S3AdaptorError` with a `code` property.

| Class                | `code`           | When                          |
|----------------------|------------------|-------------------------------|
| `NotFoundError`      | `NOT_FOUND`      | Object missing                |
| `AccessDeniedError`  | `ACCESS_DENIED`  | No token on protected bucket  |
| `InvalidTokenError`  | `INVALID_TOKEN`  | Tampered or wrong-scope token |
| `TokenExpiredError`  | `TOKEN_EXPIRED`  | Token past expiry             |
| `InvalidConfigError` | `INVALID_CONFIG` | Bad constructor config        |

## Scripts

```bash
pnpm build    # tsc → dist/
pnpm test     # jest
pnpm format   # prettier --write ./src
pnpm lint     # eslint src
```
