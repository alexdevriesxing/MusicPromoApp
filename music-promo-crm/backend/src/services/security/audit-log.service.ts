import { prisma } from '../../../prisma';
import { logger } from '../../utils/logger';
import { Request } from 'express';

export const auditLogService = {
  /**
   * Log an audit event
   */
  async logEvent(
    userId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    metadata: Record<string, any> = {},
    req?: Request
  ) {
    try {
      const ipAddress = req?.ip || req?.socket.remoteAddress || 'unknown';
      const userAgent = req?.get('user-agent') || 'unknown';

      await prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          metadata,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      logger.error('Failed to log audit event:', error);
      // Don't throw, as we don't want to break the main operation
    }
  },

  /**
   * Get audit logs with pagination
   */
  async getAuditLogs(
    page: number = 1,
    pageSize: number = 20,
    filters: {
      userId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Log a security event (wrapper around logEvent with security context)
   */
  async logSecurityEvent(
    userId: string,
    action: string,
    metadata: Record<string, any> = {},
    req?: Request
  ) {
    return this.logEvent(userId, `SECURITY_${action}`, 'SECURITY', undefined, metadata, req);
  },

  /**
   * Log a login attempt
   */
  async logLoginAttempt(
    email: string,
    success: boolean,
    ipAddress: string,
    userAgent?: string
  ) {
    try {
      await prisma.loginAttempt.create({
        data: {
          email,
          ipAddress,
          userAgent,
          success,
        },
      });
    } catch (error) {
      logger.error('Failed to log login attempt:', error);
    }
  },

  /**
   * Get failed login attempts count for an IP address within a time window
   */
  async getFailedLoginAttemptsCount(
    ipAddress: string,
    timeWindowMinutes: number = 15
  ): Promise<number> {
    const timeWindow = new Date();
    timeWindow.setMinutes(timeWindow.getMinutes() - timeWindowMinutes);

    return prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: {
          gte: timeWindow,
        },
      },
    });
  },

  /**
   * Get user's recent login history
   */
  async getUserLoginHistory(
    email: string,
    limit: number = 10
  ) {
    return prisma.loginAttempt.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

export default auditLogService;
