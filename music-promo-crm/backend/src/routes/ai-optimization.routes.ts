import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { aiOptimizationService } from '../services/ai/ai-optimization.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/ai/analyze-content:
 *   post:
 *     summary: Analyze email content for optimization
 *     tags: [AI Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The email content to analyze
 *     responses:
 *       200:
 *         description: Content analysis results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContentAnalysis'
 *       400:
 *         description: Invalid input
 */
router.post('/analyze-content', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const analysis = await aiOptimizationService.analyzeContent(content);
    res.json(analysis);
  } catch (error) {
    logger.error('Error analyzing content:', error);
    res.status(500).json({ message: 'Failed to analyze content' });
  }
});

/**
 * @swagger
 * /api/ai/optimal-send-time:
 *   get:
 *     summary: Get optimal send time for campaigns
 *     tags: [AI Optimization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Optimal send time information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OptimalSendTime'
 */
router.get('/optimal-send-time', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const optimalTime = await aiOptimizationService.generateOptimalSendTime(userId);
    res.json(optimalTime);
  } catch (error) {
    logger.error('Error getting optimal send time:', error);
    res.status(500).json({ message: 'Failed to calculate optimal send time' });
  }
});

/**
 * @swagger
 * /api/ai/generate-subject-lines:
 *   post:
 *     summary: Generate subject line variations
 *     tags: [AI Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The email content to generate subject lines for
 *               count:
 *                 type: number
 *                 description: Number of variations to generate (default: 3)
 *     responses:
 *       200:
 *         description: Generated subject lines
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
router.post('/generate-subject-lines', requireAuth, async (req, res) => {
  try {
    const { content, count = 3 } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const subjectLines = await aiOptimizationService.generateSubjectLineVariations(
      content,
      count
    );
    res.json(subjectLines);
  } catch (error) {
    logger.error('Error generating subject lines:', error);
    res.status(500).json({ message: 'Failed to generate subject lines' });
  }
});

/**
 * @swagger
 * /api/ai/personalize-content:
 *   post:
 *     summary: Personalize email content
 *     tags: [AI Optimization]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - userData
 *             properties:
 *               content:
 *                 type: string
 *                 description: The email content to personalize
 *               userData:
 *                 type: object
 *                 description: User data to use for personalization
 *     responses:
 *       200:
 *         description: Personalized content
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.post('/personalize-content', requireAuth, async (req, res) => {
  try {
    const { content, userData } = req.body;
    if (!content || !userData) {
      return res.status(400).json({ message: 'Content and userData are required' });
    }

    const personalizedContent = await aiOptimizationService.personalizeContent(
      content,
      userData
    );
    res.send(personalizedContent);
  } catch (error) {
    logger.error('Error personalizing content:', error);
    res.status(500).json({ message: 'Failed to personalize content' });
  }
});

export default router;
