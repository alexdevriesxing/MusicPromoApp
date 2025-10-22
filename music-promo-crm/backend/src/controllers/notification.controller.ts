import { Request, Response } from 'express';
import { notificationService } from '../services/notifications/notification.service';
import { logger } from '../utils/logger';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { validateRequest } from '../middleware/validate-request';
import { body } from 'express-validator';

class NotificationController {
  /**
   * Get user notifications
   */
  getNotifications = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const read = req.query.read ? req.query.read === 'true' : undefined;
      const type = req.query.type as NotificationType | undefined;
      const channel = req.query.channel as NotificationChannel | undefined;

      const result = await notificationService.getNotifications({
        userId,
        page,
        pageSize,
        read,
        type,
        channel,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
      });
    }
  };

  /**
   * Get unread notification count
   */
  getUnreadCount = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread count',
      });
    }
  };

  /**
   * Mark notifications as read
   */
  markAsRead = [
    validateRequest([
      body('notificationIds')
        .isArray()
        .withMessage('notificationIds must be an array'),
      body('notificationIds.*')
        .isString()
        .withMessage('Each notification ID must be a string'),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { notificationIds } = req.body;

        await notificationService.markAsRead({
          notificationIds,
          userId,
        });

        res.json({
          success: true,
          message: 'Notifications marked as read',
        });
      } catch (error) {
        logger.error('Error marking notifications as read:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to mark notifications as read',
        });
      }
    },
  ];

  /**
   * Get notification preferences
   */
  getPreferences = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const preferences = await notificationService.getNotificationPreferences(
        userId
      );

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences',
      });
    }
  };

  /**
   * Update notification preferences
   */
  updatePreferences = [
    validateRequest([
      body('updates')
        .isArray()
        .withMessage('updates must be an array'),
      body('updates.*.type')
        .isString()
        .isIn(Object.values(NotificationType))
        .withMessage('Invalid notification type'),
      body('updates.*.channel')
        .isString()
        .isIn(Object.values(NotificationChannel))
        .withMessage('Invalid notification channel'),
      body('updates.*.enabled')
        .isBoolean()
        .withMessage('enabled must be a boolean'),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { updates } = req.body;

        await notificationService.updateNotificationPreferences(userId, updates);

        res.json({
          success: true,
          message: 'Notification preferences updated',
        });
      } catch (error) {
        logger.error('Error updating notification preferences:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to update notification preferences',
        });
      }
    },
  ];

  /**
   * Test notification (for development only)
   */
  testNotification = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { type, title, message, data } = req.body;

      const notification = await notificationService.createNotification({
        type: type || 'SYSTEM',
        userId,
        title: title || 'Test Notification',
        message: message || 'This is a test notification',
        data: data || { test: true },
      });

      res.json({
        success: true,
        message: 'Test notification sent',
        data: notification,
      });
    } catch (error) {
      logger.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
      });
    }
  };
}

export const notificationController = new NotificationController();
