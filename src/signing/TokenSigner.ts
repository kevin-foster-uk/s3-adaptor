import { createHmac, timingSafeEqual } from 'crypto'
import { InvalidTokenError, TokenExpiredError } from '../errors'

export interface TokenPayload {
  bucket: string
  key: string
  exp: number
  // Bound into the signature so a caller can't override the response
  // Content-Disposition the URL was signed with (e.g. downgrading a
  // deliberately-forced "attachment" to "inline") by editing the query
  // string, since that string never carries a signature of its own.
  disposition?: string
}

export class TokenSigner {
  constructor(private readonly secretKey: string) {}

  sign(payload: TokenPayload): string {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const sig = createHmac('sha256', this.secretKey).update(data).digest('base64url')
    return `${data}.${sig}`
  }

  verify(token: string): TokenPayload {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) throw new InvalidTokenError()

    const data = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)

    const expected = createHmac('sha256', this.secretKey).update(data).digest('base64url')

    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw new InvalidTokenError()
    }

    let payload: TokenPayload
    try {
      payload = JSON.parse(Buffer.from(data, 'base64url').toString())
    } catch {
      throw new InvalidTokenError()
    }

    if (Date.now() > payload.exp * 1000) throw new TokenExpiredError()

    return payload
  }
}
