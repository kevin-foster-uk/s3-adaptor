# s3-adaptor

## 0.2.0

### Minor Changes

- 5235bf0: Bind the response `Content-Disposition` into the signed local-storage token instead of accepting it as a bare, unsigned query parameter. Previously, anyone holding a valid signed URL for a private-bucket object could freely change or add a `?disposition=` query parameter to override the disposition the URL was originally signed with (e.g. turning a deliberately-forced `attachment` into `inline`), since that parameter was never part of what got signed. `TokenSigner`'s payload now carries an optional `disposition`, `LocalAdapter.getSignedUrl` signs it in rather than appending it as a separate query param, and `localFileMiddleware` reads the disposition to serve from the verified token rather than from the request's raw query string. Public buckets are unaffected - they have no token to bind a disposition into, and carry no equivalent confidentiality assumption.

### Patch Changes

- 87d9172: `createLocalFileMiddleware` now reads the object key from an Express 5 named wildcard (`/:bucket/*key`, delivered as an array of path segments) as well as the Express 4 `params[0]` form. Express 5 rejects the unnamed `*` route, so consumers on Express 5 must mount the middleware as `/:bucket/*key`. The README example is updated, and `@types/express` is bumped to 5.

## 0.1.0

Initial tracked release. Versions before this point were not maintained; this baseline
starts changelog tracking via [Changesets](https://github.com/changesets/changesets).
