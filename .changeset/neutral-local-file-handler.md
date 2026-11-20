---
's3-adaptor': minor
---

Add `createLocalFileHandler`, a framework-neutral handler for serving local-mode files over any HTTP framework (`LocalFileRequest`, `LocalFileResponse`). `createLocalFileMiddleware` is unchanged for Express users and now wraps it.
