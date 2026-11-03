import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const logger = new Logger('HTTP');

/**
 * Structured per-request access log: method, path, status, duration, and a short
 * request id (useful for correlating a client-reported issue with a specific log
 * line). Deliberately logs nothing else - no headers, cookies, query string, or
 * body, since that's exactly where an Authorization header, session cookie,
 * password, or payment payload would end up.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomBytes(4).toString('hex');
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.log(`${requestId} ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`);
  });

  next();
}
