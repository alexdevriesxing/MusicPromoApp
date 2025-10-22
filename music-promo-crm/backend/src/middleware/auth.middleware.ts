import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { logger } from '../utils/logger';
import { auditLogService } from '../services/security/audit-log.service';
import { securityService } from '../services/security/security.service';
import rateLimit from 'express-rate-limit';

interface JwtPayload {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

// Rate limiting for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true, // only count failed requests
  keyGenerator: (req) => {
    return req.ip; // Use IP address for rate limiting
  },
  handler: (req, res) => {
    const ip = req.ip;
    logger.warn(`Rate limit exceeded for IP: ${ip}`);
    
    // Log the rate limit event
    auditLogService.logSecurityEvent(
      'system',
      'RATE_LIMIT_EXCEEDED',
      { ip, path: req.path, method: req.method },
      req as any
    );
    
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});

// Block IP addresses with too many failed attempts
export const blockBannedIPs = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  
  try {
    // Check if IP is in the banned list (you would implement this in your database)
    const isBanned = await securityService.isIPBanned(ip);
    
    if (isBanned) {
      logger.warn(`Blocked banned IP: ${ip}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking banned IPs:', error);
    next(); // Continue even if there's an error
  }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    const ip = req.ip;
    
    if (!token) {
      await auditLogService.logSecurityEvent(
        'anonymous',
        'AUTH_FAILED_NO_TOKEN',
        { ip, path: req.path, method: req.method },
        req as any
      );
      return res.status(401).json({ 
        success: false,
        message: 'No token, authorization denied' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret') as JwtPayload;
    } catch (error) {
      await auditLogService.logSecurityEvent(
        'anonymous',
        'AUTH_FAILED_INVALID_TOKEN',
        { ip, path: req.path, method: req.method },
        req as any
      );
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        isActive: true,
        accountLockedUntil: true,
        twoFactorEnabled: true,
        requires2FA: true,
        role: true,
      },
    });

    // Check if account is locked
    if (user?.accountLockedUntil && user.accountLockedUntil > new Date()) {
      await auditLogService.logSecurityEvent(
        user.id,
        'ACCOUNT_LOCKED_ACCESS_ATTEMPT',
        { ip, path: req.path, method: req.method },
        req as any
      );
      
      return res.status(403).json({ 
        success: false,
        message: 'Account is temporarily locked due to too many failed attempts',
        retryAfter: Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000), // in seconds
      });
    }

    if (!user || !user.isActive) {
      await auditLogService.logSecurityEvent(
        'anonymous',
        'AUTH_FAILED_INACTIVE_ACCOUNT',
        { userId: decoded.id, ip, path: req.path, method: req.method },
        req as any
      );
      
      return res.status(401).json({ 
        success: false,
        message: 'User not found or inactive' 
      });
    }

    // Reset failed login attempts on successful authentication
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          failedLoginAttempts: 0,
          accountLockedUntil: null,
        },
      });
    }

    // Check if 2FA is required but not verified
    const requires2FA = user.requires2FA || user.twoFactorEnabled;
    const is2FAPath = req.path.endsWith('/2fa/verify') || 
                     req.path.endsWith('/2fa/backup-codes/verify');
    
    if (requires2FA && !is2FAPath && !decoded.twoFactorVerified) {
      return res.status(403).json({
        success: false,
        code: '2FA_REQUIRED',
        message: 'Two-factor authentication is required',
      });

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      requires2FA: user.requires2FA,
    };

    // Log successful authentication
    await auditLogService.logSecurityEvent(
      user.id,
      'AUTH_SUCCESS',
      { ip, path: req.path, method: req.method },
      req as any
    );

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    next();
  } catch (error) {
    const ip = req.ip;
    logger.error('Authentication error:', error);
    
    // Log failed authentication
    await auditLogService.logSecurityEvent(
      'anonymous',
      'AUTH_ERROR',
      { 
        ip, 
        path: req.path, 
        method: req.method,
        error: error.message 
      },
      req as any
    );
    
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
};

// For optional authentication (user is attached if token is valid, but not required)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret') as JwtPayload;
        
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            email: true,
            isActive: true,
            role: true,
            twoFactorEnabled: true,
            requires2FA: true,
          },
        });

        if (user && user.isActive) {
          // For optional auth, we still want to check if the account is locked
          if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            // Don't attach user if account is locked
            return next();
          }
          
          req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            twoFactorEnabled: user.twoFactorEnabled,
            requires2FA: user.requires2FA,
          };
          
          // Update last activity time (but not last login time)
          await prisma.user.update({
            where: { id: user.id },
            data: { lastActivityAt: new Date() },
          });
        }
      } catch (error) {
        // Don't throw error for optional auth, just continue
        logger.debug('Optional auth token validation failed:', error.message);
      }
    }
    
    next();
  } catch (error) {
    // Don't throw error for optional auth, just continue
    logger.error('Error in optionalAuth middleware:', error);
    next();
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }
    
    const userRole = req.user.role || 'USER';
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      // Log unauthorized access attempt
      auditLogService.logSecurityEvent(
        req.user.id,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        { 
          path: req.path, 
          method: req.method,
          userRole,
          requiredRoles: allowedRoles,
        },
        req as any
      );
      
      return res.status(403).json({ 
        success: false,
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user has any of the required permissions
 */
export const requirePermission = (permissions: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }
    
    try {
      const userPermissions = await getUserPermissions(req.user.id);
      const requiredPerms = Array.isArray(permissions) ? permissions : [permissions];
      
      const hasPermission = requiredPerms.some(perm => userPermissions.includes(perm));
      
      if (!hasPermission) {
        // Log unauthorized access attempt
        await auditLogService.logSecurityEvent(
          req.user.id,
          'UNAUTHORIZED_PERMISSION_ATTEMPT',
          { 
            path: req.path, 
            method: req.method,
            userPermissions,
            requiredPermissions: requiredPerms,
          },
          req as any
        );
        
        return res.status(403).json({ 
          success: false,
          message: 'Insufficient permissions' 
        });
      }
      
      next();
    } catch (error) {
      logger.error('Error checking permissions:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error checking permissions' 
      });
    }
  };
};

// Helper function to get user permissions (you would implement this based on your permission system)
async function getUserPermissions(userId: string): Promise<string[]> {
  // In a real app, you would fetch this from your database
  // This is a simplified example
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  
  // Map roles to permissions (you would customize this based on your app)
  const rolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: ['*'],
    ADMIN: [
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'settings:read',
      'settings:update',
    ],
    MANAGER: [
      'users:read',
      'users:create',
      'users:update',
      'settings:read',
    ],
    USER: [
      'profile:read',
      'profile:update',
    ],
    GUEST: [
      'public:read',
    ],
  };
  
  const role = user?.role || 'GUEST';
  return rolePermissions[role] || [];
}
