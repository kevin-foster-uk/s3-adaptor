import { TokenSigner } from './TokenSigner'
import { InvalidTokenError, TokenExpiredError } from '../errors'

const SECRET = 'supersecretkey-atleast-32-chars!!'

describe('TokenSigner', () => {
  let signer: TokenSigner

  beforeEach(() => {
    signer = new TokenSigner(SECRET)
  })

  it('signs and verifies a valid token', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const payload = { bucket: 'my-bucket', key: 'path/to/file.txt', exp }
    const token = signer.sign(payload)
    const result = signer.verify(token)
    expect(result).toEqual(payload)
  })

  it('throws TokenExpiredError for expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 1
    const token = signer.sign({ bucket: 'b', key: 'k', exp })
    expect(() => signer.verify(token)).toThrow(TokenExpiredError)
  })

  it('throws InvalidTokenError for tampered signature', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = signer.sign({ bucket: 'b', key: 'k', exp })
    const tampered = token.slice(0, -3) + 'xxx'
    expect(() => signer.verify(tampered)).toThrow(InvalidTokenError)
  })

  it('throws InvalidTokenError for token with no dot', () => {
    expect(() => signer.verify('nodothere')).toThrow(InvalidTokenError)
  })

  it('throws InvalidTokenError for token with invalid base64 payload', () => {
    expect(() => signer.verify('!!!.sig')).toThrow(InvalidTokenError)
  })

  it('rejects token signed with different secret', () => {
    const other = new TokenSigner('different-secret-key-atleast-32ch')
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = other.sign({ bucket: 'b', key: 'k', exp })
    expect(() => signer.verify(token)).toThrow(InvalidTokenError)
  })
})
