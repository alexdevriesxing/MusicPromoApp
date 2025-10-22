import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics/analytics.service';
import { logger } from '../utils/logger';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { validateRequest } from '../middleware/validate-request';
import { body, query } from 'express-validator';

class AnalyticsController {
  /**
   * Get campaign performance metrics
   */
  getCampaignPerformance = [
    validateRequest([
      query('startDate').optional().isISO8601().toDate(),
      query('endDate').optional().isISO8601().toDate(),
      query('campaignId').optional().isString(),
      query('platform').optional().isString(),
      query('status').optional().isArray(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // Default to last 30 days if no date range provided
        const endDate = req.query.endDate 
          ? new Date(req.query.endDate as string) 
          : new Date();
        
        const startDate = req.query.startDate 
          ? new Date(req.query.startDate as string)
          : subDays(endDate, 30);

        const filters = {
          campaignId: req.query.campaignId as string | undefined,
          platform: req.query.platform as string | undefined,
          status: req.query.status as string[] | undefined,
        };

        const data = await analyticsService.getCampaignPerformance(
          userId,
          { startDate, endDate },
          filters
        );

        res.json({
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Error getting campaign performance:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to get campaign performance',
        });
      }
    },
  ];

  /**
   * Get user engagement metrics
   */
  getUserEngagement = [
    validateRequest([
      query('startDate').optional().isISO8601().toDate(),
      query('endDate').optional().isISO8601().toDate(),
      query('userSegment').optional().isString(),
      query('actionType').optional().isString(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // Default to last 7 days if no date range provided
        const endDate = req.query.endDate 
          ? new Date(req.query.endDate as string) 
          : new Date();
        
        const startDate = req.query.startDate 
          ? new Date(req.query.startDate as string)
          : subDays(endDate, 7);

        const filters = {
          userSegment: req.query.userSegment as string | undefined,
          actionType: req.query.actionType as string | undefined,
        };

        const data = await analyticsService.getUserEngagement(
          userId,
          { startDate, endDate },
          filters
        );

        res.json({
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Error getting user engagement:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to get user engagement',
        });
      }
    },
  ];

  /**
   * Get revenue metrics
   */
  getRevenueMetrics = [
    validateRequest([
      query('startDate').optional().isISO8601().toDate(),
      query('endDate').optional().isISO8601().toDate(),
      query('source').optional().isString(),
      query('productId').optional().isString(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        // Default to last 30 days if no date range provided
        const endDate = req.query.endDate 
          ? new Date(req.query.endDate as string) 
          : new Date();
        
        const startDate = req.query.startDate 
          ? new Date(req.query.startDate as string)
          : subDays(endDate, 30);

        const filters = {
          source: req.query.source as string | undefined,
          productId: req.query.productId as string | undefined,
        };

        const data = await analyticsService.getRevenueMetrics(
          userId,
          { startDate, endDate },
          filters
        );

        res.json({
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Error getting revenue metrics:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to get revenue metrics',
        });
      }
    },
  ];

  /**
   * Generate a custom report
   */
  generateCustomReport = [
    validateRequest([
      query('reportType').isString().isIn(['campaign-performance', 'user-engagement', 'revenue']),
      query('startDate').optional().isISO8601().toDate(),
      query('endDate').optional().isISO8601().toDate(),
      query('format').optional().isIn(['json', 'csv', 'pdf']).default('json'),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { reportType, format = 'json' } = req.query as {
          reportType: string;
          format: 'json' | 'csv' | 'pdf';
        };

        // Default to last 30 days if no date range provided
        const endDate = req.query.endDate 
          ? new Date(req.query.endDate as string) 
          : new Date();
        
        const startDate = req.query.startDate 
          ? new Date(req.query.startDate as string)
          : subDays(endDate, 30);

        // Get filters from query params
        const filters = { ...req.query };
        // Remove known query params that aren't filters
        ['reportType', 'startDate', 'endDate', 'format'].forEach(key => delete filters[key]);

        const result = await analyticsService.generateCustomReport(
          userId,
          reportType,
          { startDate, endDate },
          filters,
          {
            format,
            includeCharts: req.query.includeCharts === 'true',
          }
        );

        // Set appropriate headers based on format
        if (format === 'csv') {
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${reportType}-${new Date().toISOString()}.csv`);
          return res.send(result);
        } else if (format === 'pdf') {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=${reportType}-${new Date().toISOString()}.pdf`);
          return res.send(result);
        }

        // Default to JSON response
        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        logger.error('Error generating custom report:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate custom report',
        });
      }
    },
  ];

  /**
   * Schedule a recurring report
   */
  scheduleReport = [
    validateRequest([
      body('reportType').isString().isIn(['campaign-performance', 'user-engagement', 'revenue']),
      body('schedule.frequency').isString().isIn(['daily', 'weekly', 'monthly']),
      body('schedule.timeOfDay').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
      body('schedule.recipients').isArray(),
      body('schedule.recipients.*').isEmail(),
      body('schedule.format').isIn(['json', 'csv', 'pdf']),
      body('options.includeCharts').optional().isBoolean(),
      body('options.emailSubject').optional().isString(),
      body('options.emailBody').optional().isString(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { reportType, schedule, filters = {}, options = {} } = req.body;

        const scheduledReport = await analyticsService.scheduleReport(
          userId,
          reportType,
          schedule,
          filters,
          options
        );

        res.json({
          success: true,
          data: scheduledReport,
        });
      } catch (error: any) {
        logger.error('Error scheduling report:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to schedule report',
        });
      }
    },
  ];

  /**
   * Get list of scheduled reports
   */
  getScheduledReports = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // In a real implementation, you would fetch from the database
      // This is a placeholder
      const scheduledReports = [];

      res.json({
        success: true,
        data: scheduledReports,
      });
    } catch (error) {
      logger.error('Error getting scheduled reports:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get scheduled reports',
      });
    }
  };

  /**
   * Delete a scheduled report
   */
  deleteScheduledReport = [
    validateRequest([
      param('reportId').isString(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { reportId } = req.params;

        // In a real implementation, you would delete from the database
        // and cancel any pending jobs
        // This is a placeholder
        logger.info(`Deleting scheduled report ${reportId} for user ${userId}`);

        res.json({
          success: true,
          message: 'Scheduled report deleted',
        });
      } catch (error) {
        logger.error('Error deleting scheduled report:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to delete scheduled report',
        });
      }
    },
  ];
}

export const analyticsController = new AnalyticsController();
