export class S3AdaptorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'S3AdaptorError'
  }
}

export class NotFoundError extends S3AdaptorError {
  constructor(bucket: string, key: string) {
    super(`Object not found: ${bucket}/${key}`, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class InvalidConfigError extends S3AdaptorError {
  constructor(message: string) {
    super(message, 'INVALID_CONFIG')
    this.name = 'InvalidConfigError'
  }
}

export class TokenExpiredError extends S3AdaptorError {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED')
    this.name = 'TokenExpiredError'
  }
}

export class InvalidTokenError extends S3AdaptorError {
  constructor() {
    super('Invalid token', 'INVALID_TOKEN')
    this.name = 'InvalidTokenError'
  }
}

export class AccessDeniedError extends S3AdaptorError {
  constructor() {
    super('Access denied', 'ACCESS_DENIED')
    this.name = 'AccessDeniedError'
  }
}
