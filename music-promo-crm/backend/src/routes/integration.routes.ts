import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { integrationService } from '../services/integration/integration.service';
import { logger } from '../utils/logger';
import { body, param, validationResult } from 'express-validator';
import { IntegrationType } from '../services/integration/integration.service';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Integration:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [EMAIL_PROVIDER, SOCIAL_MEDIA, PAYMENT_GATEWAY, ANALYTICS, OTHER]
 *         isActive:
 *           type: boolean
 *         userId:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     IntegrationCreateRequest:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - config
 *       properties:
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [EMAIL_PROVIDER, SOCIAL_MEDIA, PAYMENT_GATEWAY, ANALYTICS, OTHER]
 *         config:
 *           type: object
 *           additionalProperties: true
 * 
 *     IntegrationTestRequest:
 *       type: object
 *       properties:
 *         config:
 *           type: object
 *           additionalProperties: true
 */

/**
 * @swagger
 * /api/integrations:
 *   post:
 *     summary: Create a new integration
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IntegrationCreateRequest'
 *     responses:
 *       201:
 *         description: Integration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Integration'
 *       400:
 *         description: Invalid input
 */
router.post(
  '/',
  requireAuth,
  [
    body('name').isString().notEmpty(),
    body('type').isIn([
      'EMAIL_PROVIDER',
      'SOCIAL_MEDIA',
      'PAYMENT_GATEWAY',
      'ANALYTICS',
      'OTHER',
    ]),
    body('config').isObject(),
  ],
  async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, type, config } = req.body;
      const integration = await integrationService.createIntegration(
        name,
        type as IntegrationType,
        config,
        req.user.id
      );
      
      res.status(201).json(integration);
    } catch (error) {
      logger.error('Error creating integration:', error);
      res.status(500).json({ message: 'Failed to create integration' });
    }
  }
);

/**
 * @swagger
 * /api/integrations/test:
 *   post:
 *     summary: Test an integration configuration
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IntegrationTestRequest'
 *     responses:
 *       200:
 *         description: Integration test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input or test failed
 */
router.post(
  '/test',
  requireAuth,
  [
    body('type').isIn([
      'EMAIL_PROVIDER',
      'SOCIAL_MEDIA',
      'PAYMENT_GATEWAY',
      'ANALYTICS',
      'OTHER',
    ]),
    body('config').isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { type, config } = req.body;
      const testResult = await integrationService.testIntegration(type, config);
      res.json(testResult);
    } catch (error) {
      logger.error('Integration test failed:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message || 'Integration test failed' 
      });
    }
  }
);

/**
 * @swagger
 * /api/integrations/{id}/webhook:
 *   post:
 *     summary: Trigger a webhook for an integration
 *     tags: [Integrations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Integration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       202:
 *         description: Webhook queued for processing
 *       404:
 *         description: Integration not found
 */
router.post(
  '/:id/webhook',
  [
    param('id').isString().notEmpty(),
    body('event').isString().notEmpty(),
    body('data').optional().isObject(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const { event, data = {} } = req.body;
      
      const webhookId = await integrationService.queueWebhookEvent(
        id,
        event,
        data
      );
      
      res.status(202).json({ 
        success: true, 
        webhookId,
        message: 'Webhook queued for processing' 
      });
    } catch (error) {
      logger.error('Error queuing webhook:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to queue webhook' 
      });
    }
  }
);

export default router;
