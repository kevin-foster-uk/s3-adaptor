import type { RequestHandler } from 'express'
import type { LocalConfig } from '../types'
import { createLocalFileHandler } from './localFileHandler'

/** Express middleware over `createLocalFileHandler`. */
export function createLocalFileMiddleware(config: LocalConfig): RequestHandler {
  const handle = createLocalFileHandler(config)

  return (req, res, next) =>
    handle(
      req,
      {
        status: (code) => res.status(code),
        header: (name, value) => res.setHeader(name, value),
        stream: async (readable) => {
          readable.pipe(res)
        },
      },
      next,
    )
}
