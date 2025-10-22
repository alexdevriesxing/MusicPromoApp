import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { automationService } from '../services/automation/automation.service';
import { logger } from '../utils/logger';
import { body, param, validationResult } from 'express-validator';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AutomationRule:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         triggerType:
 *           type: string
 *           enum: [EVENT, SCHEDULE, WEBHOOK, MANUAL]
 *         triggerConfig:
 *           type: object
 *         actions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               config:
 *                 type: object
 *               order:
 *                 type: number
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
 *     AutomationRuleCreateRequest:
 *       type: object
 *       required:
 *         - name
 *         - triggerType
 *         - triggerConfig
 *         - actions
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         triggerType:
 *           type: string
 *           enum: [EVENT, SCHEDULE, WEBHOOK, MANUAL]
 *         triggerConfig:
 *           type: object
 *         actions:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - type
 *               - config
 *               - order
 *             properties:
 *               type:
 *                 type: string
 *               config:
 *                 type: object
 *               order:
 *                 type: number
 *         isActive:
 *           type: boolean
 *           default: true
 * 
 *     AutomationTriggerRequest:
 *       type: object
 *       properties:
 *         data:
 *           type: object
 *           description: Additional data to pass to the automation
 */

/**
 * @swagger
 * /api/automation/rules:
 *   post:
 *     summary: Create a new automation rule
 *     tags: [Automation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AutomationRuleCreateRequest'
 *     responses:
 *       201:
 *         description: Automation rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AutomationRule'
 *       400:
 *         description: Invalid input
 */
router.post(
  '/rules',
  requireAuth,
  [
    body('name').isString().notEmpty(),
    body('description').optional().isString(),
    body('triggerType').isIn(['EVENT', 'SCHEDULE', 'WEBHOOK', 'MANUAL']),
    body('triggerConfig').isObject(),
    body('actions').isArray().notEmpty(),
    body('isActive').optional().isBoolean(),
  ],
  async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const ruleData = {
        ...req.body,
        userId: req.user.id,
      };
      
      const rule = await automationService.createAutomationRule(ruleData);
      res.status(201).json(rule);
    } catch (error) {
      logger.error('Error creating automation rule:', error);
      res.status(500).json({ message: 'Failed to create automation rule' });
    }
  }
);

/**
 * @swagger
 * /api/automation/rules/{id}/trigger:
 *   post:
 *     summary: Manually trigger an automation rule
 *     tags: [Automation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Automation rule ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AutomationTriggerRequest'
 *     responses:
 *       202:
 *         description: Automation rule triggered successfully
 *       404:
 *         description: Automation rule not found
 */
router.post(
  '/rules/:id/trigger',
  requireAuth,
  [
    param('id').isString().notEmpty(),
    body('data').optional().isObject(),
  ],
  async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const triggerData = req.body.data || {};
      
      // In a real implementation, you would check if the user has permission to trigger this rule
      
      // Execute the rule asynchronously
      automationService.executeRule(id, {
        ...triggerData,
        triggeredBy: req.user.id,
        triggeredAt: new Date().toISOString(),
      });
      
      res.status(202).json({ 
        success: true, 
        message: 'Automation rule triggered successfully' 
      });
    } catch (error) {
      logger.error('Error triggering automation rule:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to trigger automation rule' 
      });
    }
  }
);

export default router;
