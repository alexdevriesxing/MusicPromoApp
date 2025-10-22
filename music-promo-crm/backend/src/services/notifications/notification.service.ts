import { prisma } from '../../../prisma';
import { logger } from '../../utils/logger';
import { NotificationType, NotificationChannel, Prisma } from '@prisma/client';
import { webSocketService } from './websocket.service';
import { sendEmail } from '../email/email.service';

export interface CreateNotificationInput {
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  channels?: NotificationChannel[];
}

export interface MarkAsReadInput {
  notificationIds: string[];
  userId: string;
}

export interface GetNotificationsInput {
  userId: string;
  page?: number;
  pageSize?: number;
  read?: boolean;
  type?: NotificationType;
  channel?: NotificationChannel;
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification
   */
  async createNotification(input: CreateNotificationInput) {
    const {
      type,
      userId,
      title,
      message,
      data = {},
      relatedEntityType,
      relatedEntityId,
      channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    } = input;

    try {
      // Create the notification in the database
      const notification = await prisma.notification.create({
        data: {
          type,
          title,
          message,
          data,
          userId,
          relatedEntityType,
          relatedEntityId,
          channels: {
            create: channels.map(channel => ({
              channel,
              status: 'PENDING',
            })),
          },
        },
        include: {
          channels: true,
        },
      });

      // Deliver the notification through the appropriate channels
      await this.deliverNotification(notification, channels);

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  /**
   * Deliver a notification through the specified channels
   */
  private async deliverNotification(
    notification: any,
    channels: NotificationChannel[]
  ) {
    const deliveryPromises = channels.map(async (channel) => {
      try {
        switch (channel) {
          case NotificationChannel.IN_APP:
            await this.deliverInAppNotification(notification);
            break;
          case NotificationChannel.EMAIL:
            await this.deliverEmailNotification(notification);
            break;
          case NotificationChannel.PUSH:
            await this.deliverPushNotification(notification);
            break;
          case NotificationChannel.SMS:
            await this.deliverSmsNotification(notification);
            break;
        }
        
        // Update delivery status
        await prisma.notificationChannel.updateMany({
          where: {
            notificationId: notification.id,
            channel,
          },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
          },
        });
      } catch (error) {
        logger.error(`Failed to deliver ${channel} notification:`, error);
        
        // Update delivery status to failed
        await prisma.notificationChannel.updateMany({
          where: {
            notificationId: notification.id,
            channel,
          },
          data: {
            status: 'FAILED',
            error: error.message,
          },
        });
      }
    });

    await Promise.all(deliveryPromises);
  }

  /**
   * Deliver an in-app notification via WebSocket
   */
  private async deliverInAppNotification(notification: any) {
    if (!webSocketService) {
      throw new Error('WebSocket service not initialized');
    }

    webSocketService.sendToUser(
      notification.userId,
      'notification:new',
      notification
    );
  }

  /**
   * Deliver an email notification
   */
  private async deliverEmailNotification(notification: any) {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, name: true },
    });

    if (!user?.email) {
      throw new Error('User email not found');
    }

    await sendEmail({
      to: user.email,
      subject: notification.title,
      template: 'notification',
      data: {
        name: user.name,
        title: notification.title,
        message: notification.message,
        ...notification.data,
      },
    });
  }

  /**
   * Deliver a push notification
   */
  private async deliverPushNotification(notification: any) {
    // Implementation would depend on your push notification service (e.g., Firebase, OneSignal)
    // This is a placeholder implementation
    logger.info(`Sending push notification: ${notification.title}`);
  }

  /**
   * Deliver an SMS notification
   */
  private async deliverSmsNotification(notification: any) {
    // Implementation would depend on your SMS service provider
    // This is a placeholder implementation
    logger.info(`Sending SMS notification: ${notification.title}`);
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(input: MarkAsReadInput) {
    const { notificationIds, userId } = input;

    try {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      // Notify the client that notifications were read
      if (webSocketService) {
        webSocketService.sendToUser(userId, 'notifications:read', {
          notificationIds,
          readAt: new Date(),
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error marking notifications as read:', error);
      throw new Error('Failed to mark notifications as read');
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getNotifications(input: GetNotificationsInput) {
    const {
      userId,
      page = 1,
      pageSize = 20,
      read,
      type,
      channel,
    } = input;

    const skip = (page - 1) * pageSize;
    const where: Prisma.NotificationWhereInput = { userId };

    if (typeof read === 'boolean') {
      where.readAt = read ? { not: null } : null;
    }

    if (type) {
      where.type = type;
    }

    if (channel) {
      where.channels = {
        some: { channel },
      };
    }

    try {
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            channels: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        data: notifications,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw new Error('Failed to fetch notifications');
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string) {
    try {
      return await prisma.notification.count({
        where: {
          userId,
          readAt: null,
        },
      });
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      throw new Error('Failed to get unread notification count');
    }
  }

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(userId: string) {
    try {
      const preferences = await prisma.notificationPreference.findMany({
        where: { userId },
      });

      // If no preferences exist, create default ones
      if (preferences.length === 0) {
        return this.createDefaultPreferences(userId);
      }

      return preferences;
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      throw new Error('Failed to get notification preferences');
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    updates: Array<{
      type: NotificationType;
      channel: NotificationChannel;
      enabled: boolean;
    }>
  ) {
    const transaction = updates.map((update) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_type_channel: {
            userId,
            type: update.type,
            channel: update.channel,
          },
        },
        update: { enabled: update.enabled },
        create: {
          userId,
          type: update.type,
          channel: update.channel,
          enabled: update.enabled,
        },
      })
    );

    try {
      await prisma.$transaction(transaction);
      return { success: true };
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      throw new Error('Failed to update notification preferences');
    }
  }

  /**
   * Create default notification preferences for a user
   */
  private async createDefaultPreferences(userId: string) {
    const defaultPreferences: Prisma.NotificationPreferenceCreateManyInput[] = [];
    
    // Define default preferences for each notification type and channel
    const notificationTypes = Object.values(NotificationType);
    const channels = Object.values(NotificationChannel);

    for (const type of notificationTypes) {
      for (const channel of channels) {
        // Default to enabling all notifications
        defaultPreferences.push({
          userId,
          type,
          channel,
          enabled: true,
        });
      }
    }

    await prisma.notificationPreference.createMany({
      data: defaultPreferences,
      skipDuplicates: true,
    });

    return defaultPreferences;
  }
}

export const notificationService = NotificationService.getInstance();
