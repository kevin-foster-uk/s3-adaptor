---
"s3-adaptor": patch
---

`createLocalFileMiddleware` now reads the object key from an Express 5 named wildcard (`/:bucket/*key`, delivered as an array of path segments) as well as the Express 4 `params[0]` form. Express 5 rejects the unnamed `*` route, so consumers on Express 5 must mount the middleware as `/:bucket/*key`. The README example is updated, and `@types/express` is bumped to 5.
