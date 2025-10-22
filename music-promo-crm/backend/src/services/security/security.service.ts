import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';
import crypto from 'crypto';
import { Request } from 'express';

type SecurityEvent = {
  type: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
};

export class SecurityService {
  private static instance: SecurityService;

  private constructor() {}

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Log security-related events
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          type: event.type,
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: event.metadata,
        },
      });
    } catch (error) {
      logger.error('Error logging security event:', error);
    }
  }

  /**
   * Check if a password meets security requirements
   */
  validatePasswordStrength(password: string): { valid: boolean; message?: string } {
    if (password.length < 12) {
      return { valid: false, message: 'Password must be at least 12 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character' };
    }
    return { valid: true };
  }

  /**
   * Check if an IP address is suspicious
   */
  isSuspiciousIp(ip: string): boolean {
    // In a real implementation, this would check against known threat intelligence feeds
    // This is a simplified version that just checks for private IPs and localhost
    const privateRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '127.0.0.0/8',
      '::1/128',
    ];
    
    return privateRanges.some(range => this.isIpInRange(ip, range));
  }

  /**
   * Check if an IP is in a specific range (CIDR notation)
   */
  private isIpInRange(ip: string, cidr: string): boolean {
    const [range, bits = '32'] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0;
    
    const ipLong = this.ipToLong(ip);
    const rangeLong = this.ipToLong(range);
    
    return (ipLong & mask) === (rangeLong & mask);
  }

  /**
   * Convert IP address to a number
   */
  private ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashData(data: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(data, salt, 1000, 64, 'sha512')
      .toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string): boolean {
    const [salt, originalHash] = hash.split(':');
    const newHash = crypto
      .pbkdf2Sync(data, salt, 1000, 64, 'sha512')
      .toString('hex');
    return newHash === originalHash;
  }

  /**
   * Get client IP address from request
   */
  getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.socket.remoteAddress as string) ||
      'unknown'
    );
  }

  /**
   * Check for suspicious activity
   */
  async checkSuspiciousActivity(userId: string, req: Request): Promise<boolean> {
    const ip = this.getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Check for too many failed login attempts
    const recentFailedLogins = await prisma.securityEvent.count({
      where: {
        userId,
        type: 'LOGIN_FAILED',
        createdAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
        },
      },
    });

    if (recentFailedLogins > 5) {
      await this.logSecurityEvent({
        type: 'ACCOUNT_LOCKOUT',
        userId,
        ipAddress: ip,
        userAgent,
        metadata: { reason: 'Too many failed login attempts' },
      });
      return true;
    }

    return false;
  }
}

export const securityService = SecurityService.getInstance();
