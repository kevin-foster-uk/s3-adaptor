---
"s3-adaptor": minor
---

Bind the response `Content-Disposition` into the signed local-storage token instead of accepting it as a bare, unsigned query parameter. Previously, anyone holding a valid signed URL for a private-bucket object could freely change or add a `?disposition=` query parameter to override the disposition the URL was originally signed with (e.g. turning a deliberately-forced `attachment` into `inline`), since that parameter was never part of what got signed. `TokenSigner`'s payload now carries an optional `disposition`, `LocalAdapter.getSignedUrl` signs it in rather than appending it as a separate query param, and `localFileMiddleware` reads the disposition to serve from the verified token rather than from the request's raw query string. Public buckets are unaffected - they have no token to bind a disposition into, and carry no equivalent confidentiality assumption.
