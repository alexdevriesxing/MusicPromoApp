import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { securityService } from '../services/security/security.service';
import { logger } from '../utils/logger';
import { body, validationResult } from 'express-validator';

const router = Router();

/**
 * @swagger
 * /api/security/check-password-strength:
 *   post:
 *     summary: Check if a password meets security requirements
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: The password to check
 *     responses:
 *       200:
 *         description: Password strength check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   description: Error message if password is invalid
 */
router.post(
  '/check-password-strength',
  [
    body('password')
      .isString()
      .withMessage('Password must be a string')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;
    const result = securityService.validatePasswordStrength(password);
    res.json(result);
  }
);

/**
 * @swagger
 * /api/security/audit-logs:
 *   get:
 *     summary: Get security audit logs
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: List of security events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SecurityEvent'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/audit-logs', requireAuth, async (req: any, res) => {
  try {
    const { page = 1, limit = 10, type, userId } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const where: any = {};
    if (type) where.type = type;
    if (userId) where.userId = userId;
    
    const [total, events] = await Promise.all([
      req.prisma.securityEvent.count({ where }),
      req.prisma.securityEvent.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    
    res.json({
      data: events,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

/**
 * @swagger
 * /api/security/account-lockout/{userId}:
 *   post:
 *     summary: Lock or unlock a user account
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locked
 *             properties:
 *               locked:
 *                 type: boolean
 *                 description: Whether to lock or unlock the account
 *     responses:
 *       200:
 *         description: Account lock status updated
 *       404:
 *         description: User not found
 */
router.post(
  '/account-lockout/:userId',
  requireAuth,
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { locked } = req.body;
      
      // Check if user exists
      const user = await req.prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update user lock status
      await req.prisma.user.update({
        where: { id: userId },
        data: { isLocked: locked },
      });
      
      // Log the action
      await securityService.logSecurityEvent({
        type: locked ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED',
        userId: req.user.id,
        ipAddress: securityService.getClientIp(req),
        userAgent: req.headers['user-agent'] || 'unknown',
        metadata: {
          targetUserId: userId,
          action: locked ? 'lock' : 'unlock',
        },
      });
      
      res.json({ message: `Account ${locked ? 'locked' : 'unlocked'} successfully` });
    } catch (error) {
      logger.error('Error updating account lock status:', error);
      res.status(500).json({ message: 'Failed to update account lock status' });
    }
  }
);

export default router;
