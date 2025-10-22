import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { analyticsController } from '../controllers/analytics.controller';
import { validateRequest } from '../middleware/validate-request';
import { query } from 'express-validator';

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * @swagger
 * /api/analytics/campaign-performance:
 *   get:
 *     summary: Get campaign performance metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (ISO format)
 *       - in: query
 *         name: campaignId
 *         schema:
 *           type: string
 *         description: Filter by campaign ID
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *         description: Filter by platform
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: false
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Campaign performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CampaignPerformance'
 */
router.get('/campaign-performance', analyticsController.getCampaignPerformance);

/**
 * @swagger
 * /api/analytics/user-engagement:
 *   get:
 *     summary: Get user engagement metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (ISO format)
 *       - in: query
 *         name: userSegment
 *         schema:
 *           type: string
 *         description: Filter by user segment
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: User engagement metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserEngagement'
 */
router.get('/user-engagement', analyticsController.getUserEngagement);

/**
 * @swagger
 * /api/analytics/revenue:
 *   get:
 *     summary: Get revenue metrics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (ISO format)
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *         description: Filter by source
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *         description: Filter by product ID
 *     responses:
 *       200:
 *         description: Revenue metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RevenueMetrics'
 */
router.get('/revenue', analyticsController.getRevenueMetrics);

/**
 * @swagger
 * /api/analytics/reports/generate:
 *   get:
 *     summary: Generate a custom report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: reportType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [campaign-performance, user-engagement, revenue]
 *         description: Type of report to generate
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (ISO format)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv, pdf]
 *           default: json
 *         description: Output format
 *       - in: query
 *         name: includeCharts
 *         schema:
 *           type: boolean
 *         description: Include charts in the report (for PDF)
 *     responses:
 *       200:
 *         description: Generated report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Report data (format depends on report type)
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/reports/generate', analyticsController.generateCustomReport);

/**
 * @swagger
 * /api/analytics/reports/schedule:
 *   post:
 *     summary: Schedule a recurring report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - schedule
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [campaign-performance, user-engagement, revenue]
 *               schedule:
 *                 type: object
 *                 required:
 *                   - frequency
 *                   - timeOfDay
 *                   - recipients
 *                   - format
 *                 properties:
 *                   frequency:
 *                     type: string
 *                     enum: [daily, weekly, monthly]
 *                   timeOfDay:
 *                     type: string
 *                     pattern: '^([01]\d|2[0-3]):[0-5]\d$'
 *                     example: '09:00'
 *                   recipients:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: email
 *                   format:
 *                     type: string
 *                     enum: [json, csv, pdf]
 *               filters:
 *                 type: object
 *                 description: Filters to apply to the report
 *               options:
 *                 type: object
 *                 properties:
 *                   includeCharts:
 *                     type: boolean
 *                   emailSubject:
 *                     type: string
 *                   emailBody:
 *                     type: string
 *     responses:
 *       200:
 *         description: Report scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ScheduledReport'
 */
router.post('/reports/schedule', analyticsController.scheduleReport);

/**
 * @swagger
 * /api/analytics/reports/scheduled:
 *   get:
 *     summary: Get list of scheduled reports
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of scheduled reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScheduledReport'
 */
router.get('/reports/scheduled', analyticsController.getScheduledReports);

/**
 * @swagger
 * /api/analytics/reports/scheduled/{reportId}:
 *   delete:
 *     summary: Delete a scheduled report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the scheduled report to delete
 *     responses:
 *       200:
 *         description: Scheduled report deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.delete('/reports/scheduled/:reportId', analyticsController.deleteScheduledReport);

export default router;
