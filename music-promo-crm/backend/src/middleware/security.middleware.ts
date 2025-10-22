import { Request, Response, NextFunction } from 'express';
import { securityService } from '../services/security/security.service';
import { logger } from '../utils/logger';
import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware to prevent brute force attacks
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use both IP and user ID (if authenticated) for rate limiting
    const ip = securityService.getClientIp(req);
    const userId = req.user?.id || 'anonymous';
    return `${ip}:${userId}`;
  },
});

/**
 * Security headers middleware
 */
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  next();
};

/**
 * Request validation middleware
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check for potential NoSQL injection
  const hasNoSqlInjection = (obj: any): boolean => {
    if (!obj) return false;
    
    // Check if the object contains any MongoDB operators
    const mongoOperators = [
      '$where',
      '$gt',
      '$gte',
      '$lt',
      '$lte',
      '$ne',
      '$in',
      '$nin',
      '$exists',
      '$regex',
    ];

    // Check if any key in the object is a MongoDB operator
    const keys = Object.keys(obj);
    for (const key of keys) {
      if (mongoOperators.includes(key)) {
        return true;
      }
      
      // Recursively check nested objects
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (hasNoSqlInjection(obj[key])) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Check request body, query, and params for NoSQL injection
  if (
    hasNoSqlInjection(req.body) ||
    hasNoSqlInjection(req.query) ||
    hasNoSqlInjection(req.params)
  ) {
    logger.warn('Potential NoSQL injection attempt detected', {
      ip: securityService.getClientIp(req),
      url: req.originalUrl,
      method: req.method,
    });
    
    return res.status(400).json({ message: 'Invalid request' });
  }

  next();
};

/**
 * Log all requests for security auditing
 */
export const auditLogger = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  const ip = securityService.getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Log the request
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    ip,
    userAgent,
    userId: req.user?.id || 'anonymous',
  });
  
  // Override res.json to log the response
  const originalJson = res.json;
  res.json = function (body) {
    // Log the response
    logger.info('Response sent', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.id || 'anonymous',
    });
    
    return originalJson.call(this, body);
  };
  
  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  logger.error('Error occurred', {
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: securityService.getClientIp(req),
    userId: req.user?.id || 'anonymous',
  });
  
  // Don't leak error details in production
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : err.message;
  
  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
