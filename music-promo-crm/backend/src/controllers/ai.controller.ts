import { Request, Response } from 'express';
import { aiContentGenerationService } from '../services/ai/content-generation.service';
import { aiOptimizationService } from '../services/ai/optimization.service';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validate-request';
import { body, query, param } from 'express-validator';

type ContentType = 'social_media_post' | 'blog_post' | 'email' | 'ad_copy' | 'song_description';
type OptimizationType = 'seo' | 'readability' | 'engagement' | 'conversion' | 'tone';

class AIController {
  /**
   * Generate content using AI
   */
  generateContent = [
    validateRequest([
      body('contentType')
        .isIn(['social_media_post', 'blog_post', 'email', 'ad_copy', 'song_description'])
        .withMessage('Invalid content type'),
      body('topic').isString().notEmpty().withMessage('Topic is required'),
      body('tone')
        .optional()
        .isIn(['professional', 'casual', 'enthusiastic', 'informative', 'persuasive'])
        .withMessage('Invalid tone'),
      body('targetAudience').optional().isString(),
      body('keywords').optional().isArray(),
      body('length').optional().isIn(['short', 'medium', 'long']),
      body('language').optional().isString(),
      body('brandVoice').optional().isString(),
      body('callToAction').optional().isString(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const result = await aiContentGenerationService.generateContent({
          ...req.body,
          userId,
        });

        res.json({
          success: true,
          data: result.content,
          metadata: result.metadata,
        });
      } catch (error: any) {
        logger.error('Error generating content:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate content',
        });
      }
    },
  ];

  /**
   * Optimize content using AI
   */
  optimizeContent = [
    validateRequest([
      body('content').isString().notEmpty().withMessage('Content is required'),
      body('optimizationType')
        .isIn(['seo', 'readability', 'engagement', 'conversion', 'tone'])
        .withMessage('Invalid optimization type'),
      body('targetKeywords').optional().isArray(),
      body('targetAudience').optional().isString(),
      body('contentType')
        .optional()
        .isIn(['blog_post', 'social_media', 'email', 'ad_copy', 'landing_page']),
      body('tone').optional().isString(),
      body('characterLimit').optional().isInt({ min: 1 }),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const result = await aiOptimizationService.optimizeContent(
          req.body.content,
          req.body.optimizationType,
          {
            targetKeywords: req.body.targetKeywords,
            targetAudience: req.body.targetAudience,
            contentType: req.body.contentType,
            tone: req.body.tone,
            characterLimit: req.body.characterLimit,
          }
        );

        res.json({
          success: true,
          data: {
            optimizedContent: result.optimizedContent,
            score: result.score,
            suggestions: result.suggestions,
          },
          metadata: result.metadata,
        });
      } catch (error: any) {
        logger.error('Error optimizing content:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to optimize content',
        });
      }
    },
  ];

  /**
   * Generate content variations
   */
  generateVariations = [
    validateRequest([
      body('content').isString().notEmpty().withMessage('Content is required'),
      body('count').optional().isInt({ min: 1, max: 5 }).withMessage('Count must be between 1 and 5'),
      body('tone').optional().isString(),
      body('style').optional().isString(),
      body('length').optional().isIn(['shorter', 'same', 'longer']),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { content, count = 3, ...options } = req.body;
        
        const variations = await aiContentGenerationService.generateVariations(
          content,
          count,
          options
        );

        res.json({
          success: true,
          data: variations,
        });
      } catch (error: any) {
        logger.error('Error generating variations:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate variations',
        });
      }
    },
  ];

  /**
   * Generate hashtags for content
   */
  generateHashtags = [
    validateRequest([
      body('content').isString().notEmpty().withMessage('Content is required'),
      body('platform')
        .optional()
        .isIn(['instagram', 'twitter', 'tiktok', 'all'])
        .withMessage('Invalid platform'),
      body('count').optional().isInt({ min: 1, max: 30 }).withMessage('Count must be between 1 and 30'),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { content, platform = 'all', count = 10 } = req.body;
        
        const hashtags = await aiContentGenerationService.generateHashtags(
          content,
          platform,
          count
        );

        res.json({
          success: true,
          data: hashtags,
        });
      } catch (error: any) {
        logger.error('Error generating hashtags:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate hashtags',
        });
      }
    },
  ];

  /**
   * Generate an image using AI
   */
  generateImage = [
    validateRequest([
      body('prompt').isString().notEmpty().withMessage('Prompt is required'),
      body('size')
        .optional()
        .isIn(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
        .withMessage('Invalid size'),
      body('quality')
        .optional()
        .isIn(['standard', 'hd'])
        .withMessage('Invalid quality'),
      body('style')
        .optional()
        .isIn(['vivid', 'natural'])
        .withMessage('Invalid style'),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { prompt, ...options } = req.body;
        
        const result = await aiContentGenerationService.generateImage(prompt, options);

        res.json({
          success: true,
          data: {
            url: result.url,
            revisedPrompt: result.revisedPrompt,
          },
          metadata: result.metadata,
        });
      } catch (error: any) {
        logger.error('Error generating image:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate image',
        });
      }
    },
  ];

  /**
   * Generate a video script
   */
  generateVideoScript = [
    validateRequest([
      body('content').isString().notEmpty().withMessage('Content is required'),
      body('duration').optional().isInt({ min: 15, max: 600 }).withMessage('Duration must be between 15 and 600 seconds'),
      body('style')
        .optional()
        .isIn(['explainer', 'tutorial', 'storytelling', 'promotional'])
        .withMessage('Invalid style'),
      body('includeVisuals').optional().isBoolean(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { content, ...options } = req.body;
        
        const result = await aiContentGenerationService.generateVideoScript(content, options);

        res.json({
          success: true,
          data: {
            script: result.script,
            scenes: result.scenes,
          },
          metadata: result.metadata,
        });
      } catch (error: any) {
        logger.error('Error generating video script:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate video script',
        });
      }
    },
  ];

  /**
   * Perform A/B testing on content variations
   */
  performABTest = [
    validateRequest([
      body('variations')
        .isArray({ min: 2 })
        .withMessage('At least two variations are required'),
      body('variations.*.content')
        .isString()
        .notEmpty()
        .withMessage('Content is required for each variation'),
      body('variations.*.variationName')
        .isString()
        .notEmpty()
        .withMessage('Variation name is required'),
      body('testCriteria.goal')
        .isIn(['click_through', 'conversion', 'engagement', 'retention'])
        .withMessage('Invalid test goal'),
      body('testCriteria.targetAudience').optional().isString(),
      body('testCriteria.sampleSize').optional().isInt({ min: 1 }),
      body('testCriteria.durationDays').optional().isInt({ min: 1 }),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { variations, testCriteria } = req.body;
        
        const result = await aiOptimizationService.performABTest(variations, testCriteria);

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        logger.error('Error performing A/B test:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to perform A/B test',
        });
      }
    },
  ];

  /**
   * Analyze content performance
   */
  analyzeContentPerformance = [
    validateRequest([
      body('content').isString().notEmpty().withMessage('Content is required'),
      body('metrics').isObject().withMessage('Metrics must be an object'),
      body('contentType')
        .optional()
        .isIn(['blog_post', 'social_media', 'email', 'ad_copy', 'landing_page']),
      body('targetAudience').optional().isString(),
      body('comparisonData').optional().isArray(),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { content, metrics, ...options } = req.body;
        
        const result = await aiOptimizationService.analyzeContentPerformance(
          content,
          metrics,
          options
        );

        res.json({
          success: true,
          data: result,
        });
      } catch (error: any) {
        logger.error('Error analyzing content performance:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to analyze content performance',
        });
      }
    },
  ];

  /**
   * Generate optimization variations
   */
  generateOptimizationVariations = [
    validateRequest([
      body('content').isString().notEmpty().withMessage('Content is required'),
      body('optimizationType')
        .isIn(['seo', 'readability', 'engagement', 'conversion', 'tone'])
        .withMessage('Invalid optimization type'),
      body('count').optional().isInt({ min: 1, max: 5 }).withMessage('Count must be between 1 and 5'),
      body('targetKeywords').optional().isArray(),
      body('targetAudience').optional().isString(),
      body('contentType')
        .optional()
        .isIn(['blog_post', 'social_media', 'email', 'ad_copy', 'landing_page']),
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const { content, optimizationType, count = 3, ...options } = req.body;
        
        const variations = await aiOptimizationService.generateOptimizationVariations(
          content,
          optimizationType,
          count,
          options
        );

        res.json({
          success: true,
          data: variations,
        });
      } catch (error: any) {
        logger.error('Error generating optimization variations:', error);
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to generate optimization variations',
        });
      }
    },
  ];
}

export const aiController = new AIController();
