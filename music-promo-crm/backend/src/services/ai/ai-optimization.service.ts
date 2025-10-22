import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';
import OpenAI from 'openai';
import NodeCache from 'node-cache';
import * as crypto from 'crypto';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string;
    }
  }
}

// Import Prisma types
type Campaign = {
  id: string;
  userId: string;
  status: string;
  sentAt: Date | null;
  emails: Array<{
    sentAt: Date | null;
    openedAt: Date | null;
    clickedAt: Date | null;
  }>;
};

// Cache with 1 hour TTL (time to live)
const cache = new NodeCache({ stdTTL: 3600 });

type ContentAnalysis = {
  readabilityScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  keywords: string[];
  suggestions: string[];
  wordCount: number;
  readingTime: number;
  fleschReadingEase: number;
  metadata: {
    model: string;
    tokens: number;
    timestamp: Date;
  };
};

type OptimalSendTime = {
  bestDay: string;
  bestTime: string;
  confidence: number;
  nextBestTimes: Array<{
    day: string;
    time: string;
    confidence: number;
  }>;
  metadata: {
    campaignsAnalyzed: number;
    totalEmails: number;
    openRate: number;
    clickRate: number;
    timestamp: Date;
  };
};

type CachedResult<T> = {
  data: T;
  timestamp: number;
};

export class AIOptimizationService {
  private static instance: AIOptimizationService;
  private openai: OpenAI;
  private cache: NodeCache;

  private constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL
  }

  static getInstance(): AIOptimizationService {
    if (!AIOptimizationService.instance) {
      AIOptimizationService.instance = new AIOptimizationService();
    }
    return AIOptimizationService.instance;
  }

  private async makeCachedApiCall<T>(
    cacheKey: string,
    apiCall: () => Promise<T>,
    ttlSeconds = 3600
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = this.cache.get<CachedResult<T>>(cacheKey);
    
    if (cached) {
      logger.debug(`Cache hit for key: ${cacheKey}`);
      return { data: cached.data, fromCache: true };
    }

    logger.debug(`Cache miss for key: ${cacheKey}`);
    try {
      const data = await apiCall();
      
      this.cache.set<CachedResult<T>>(
        cacheKey,
        { data, timestamp: Date.now() },
        ttlSeconds
      );
      
      return { data, fromCache: false };
    } catch (error: any) {
      logger.error(`Error in makeCachedApiCall for key ${cacheKey}:`, error);
      throw error;
    }

  }

  private calculateReadingStats(content: string): { wordCount: number; readingTime: number; fleschReadingEase: number } {
    // Simple word count (split by whitespace and filter out empty strings)
    const wordCount: number = content.split(/\s+/).filter(word => word.length > 0).length;
    
    // Average reading speed (words per minute)
    const wordsPerMinute: number = 200;
    const readingTime: number = Math.ceil(wordCount / wordsPerMinute);
    
    // Simple Flesch Reading ease score approximation
{{ ... }}
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const syllables = content.toLowerCase()
      .replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '')
      .match(/[aeiouy]{1,2}/g)?.length || 0;
    
    const sentenceCount = sentences.length;
    const wordCountForScore = Math.max(1, wordCount);
    const syllableCount = Math.max(1, syllables);
    
    const fleschReadingEase = Math.min(
      100,
      Math.max(
        0,
        206.835 -
          1.015 * (wordCountForScore / Math.max(1, sentenceCount)) -
          84.6 * (syllableCount / wordCountForScore)
      )
    );

    return { wordCount, readingTime, fleschReadingEase };
  }

  private parseAnalysisResponse(response: string): Omit<ContentAnalysis, 'metadata'> {
    // Extract readability score (1-100)
    const readabilityMatch = /readability.*?(\d{1,3})/i.exec(response);
    const readabilityScore = readabilityMatch ? parseInt(readabilityMatch[1], 10) : 50;

    // Extract sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    const sentimentMatch = /sentiment.*?(positive|neutral|negative)/i.exec(response);
    if (sentimentMatch) {
      sentiment = sentimentMatch[1].toLowerCase() as 'positive' | 'neutral' | 'negative';
    }

    // Extract keywords (looking for a list after "keywords" or "top keywords")
    const keywordMatch = /keywords:[\s\S]*?([\w\s,]+)(?:\n|$)/i.exec(response) ||
                      /top.*?keywords:[\s\S]*?([\w\s,]+)(?:\n|$)/i.exec(response);
    
    let keywords: string[] = [];
    if (keywordMatch) {
      keywords = keywordMatch[1]
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
        .slice(0, 5); // Limit to top 5 keywords
    }

    // Extract suggestions (looking for numbered list or bullet points)
    const suggestionMatches = response.match(/\d+[\.\)]\s+(.+?)(?=\n\d+[\.\)]|$)/gi) || [];
    let suggestions = suggestionMatches.map((s: string) => 
      s.replace(/^\d+[\.\)]\s*/, '').trim()
    );

    // If no numbered list found, try to split by newlines and take first 5
    if (suggestions.length === 0) {
      suggestions = response
        .split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 5);
    }

    // Calculate reading stats
    const { wordCount, readingTime, fleschReadingEase } = this.calculateReadingStats(response);

    return {
      readabilityScore,
      sentiment,
      keywords,
      suggestions,
      wordCount,
      readingTime,
      fleschReadingEase,
    };
  }

  async analyzeContent(content: string): Promise<ContentAnalysis> {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    // Create a cache key based on content (first 100 chars + hash of full content)
    const contentHash = crypto
      .createHash('md5')
      .update(content)
      .digest('hex');
    const cacheKey = `content_analysis_${contentHash}`;

    try {
      const { data: analysis, fromCache } = await this.makeCachedApiCall<Omit<ContentAnalysis, 'metadata'>>(cacheKey, async () => {
        const prompt = `Analyze the following content for email marketing purposes. Provide a detailed analysis with these specific sections:

1. Readability Score: A number between 1-100 (higher is better)
2. Sentiment: One of: positive, neutral, or negative
3. Top 5 Keywords: Comma-separated list of the most important keywords
4. Suggestions for Improvement: 3-5 specific, actionable suggestions to improve the content

Content to analyze:
${content}

Please format your response clearly with section headers.`;

{{ ... }}
          const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are an expert email marketer who analyzes content for marketing effectiveness. Provide clear, actionable feedback.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1000
          });

          const result = response.choices?.[0]?.message?.content || '';
          
          if (!result) {
            throw new Error('No content in AI response');
          }
          
          return this.parseAnalysisResponse(result);
        },
        3600 // Cache for 1 hour
      );

      // Log the analysis request (but not the full content to save space)
      logger.info('Content analysis completed', {
        contentLength: content.length,
        wordCount: analysis.wordCount,
        fromCache,
      });

      return {
        ...analysis,
        metadata: {
          model: 'gpt-4',
          tokens: 0, // Would be set from the actual API response in a real implementation
          timestamp: new Date(),
        },
      };
    } catch (error: any) {
      logger.error('Error analyzing content:', {
        error: error.message,
        stack: error.stack,
        contentLength: content?.length || 0,
      });
      throw new Error(`Failed to analyze content: ${error.message}`);
    }
  }

  async generateOptimalSendTime(userId: string): Promise<OptimalSendTime> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const cacheKey = `optimal_send_time_${userId}`;
    
    try {
      const { data: result, fromCache } = await this.makeCachedApiCall<OptimalSendTime>(
        cacheKey,
        async () => {
          // Get user's historical campaign data
          const userCampaigns = await prisma.campaign.findMany({
            where: { 
              userId,
              status: 'SENT', // Only consider sent campaigns
              sentAt: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
              },
            },
            include: {
              emails: {
                select: {
                  sentAt: true,
                  openedAt: true,
                  clickedAt: true,
                },
              },
            },
          });

          if (userCampaigns.length === 0) {
            // Fallback to general best practices if no user data is available
            return this.getDefaultOptimalSendTime();
          }

          // Calculate open and click rates by day and hour
          const dayHourStats: Record<string, { opens: number; clicks: number; total: number }> = {};
          
          userCampaigns.forEach((campaign: Campaign) => {
            campaign.emails.forEach((email: { sentAt: Date | null; openedAt: Date | null; clickedAt: Date | null }) => {
              if (!email.sentAt) return;
              
              const sentDate = new Date(email.sentAt);
              const day = sentDate.toLocaleDateString('en-US', { weekday: 'long' });
              const hour = sentDate.getHours();
              const key = `${day}_${hour}`;
              
              if (!dayHourStats[key]) {
                dayHourStats[key] = { opens: 0, clicks: 0, total: 0 };
              }
              
              dayHourStats[key].total++;
              if (email.openedAt) dayHourStats[key].opens++;
              if (email.clickedAt) dayHourStats[key].clicks++;
            });
          });

          // Find the best performing time slot
          let bestKey = '';
          let bestScore = -1;
          
          Object.entries(dayHourStats).forEach(([key, stats]) => {
            if (stats.total < 5) return; // Skip if not enough data
            
            const openRate = stats.opens / stats.total;
            const clickRate = stats.clicks / stats.total;
            const score = openRate * 0.7 + clickRate * 0.3; // Weight open rate higher
            
            if (score > bestScore) {
              bestScore = score;
              bestKey = key;
            }
          });

          // If no clear winner, fall back to defaults
          if (bestKey === '') {
            return this.getDefaultOptimalSendTime();
          }

          // Calculate confidence based on data quality
          const totalEmails = Object.values(dayHourStats).reduce((sum, stat) => sum + stat.total, 0);
          const confidence = Math.min(95, Math.floor((bestScore * 100) * 0.8)); // Cap at 95%
          
          const [bestDay, bestHour] = bestKey.split('_');
          const bestTime = `${parseInt(bestHour, 10)}:00`; // Convert to hour:00 format
          
          // Calculate next best times (top 3)
          const timeSlots = Object.entries(dayHourStats)
            .filter(([key]) => key !== bestKey)
            .map(([key, stats]) => {
              const [day, hour] = key.split('_');
              const openRate = stats.opens / stats.total;
              const clickRate = stats.clicks / stats.total;
              const score = openRate * 0.7 + clickRate * 0.3;
              
              return {
                day,
                time: `${parseInt(hour, 10)}:00`,
                score,
                confidence: Math.min(90, Math.floor(score * 100 * 0.8)),
              };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

          // Calculate overall metrics
          const totalOpens = userCampaigns.reduce(
            (sum: number, campaign: Campaign) => sum + campaign.emails.filter((e: { openedAt: Date | null }) => e.openedAt).length,
            0
          );
          const totalClicks = userCampaigns.reduce(
            (sum: number, campaign: Campaign) => sum + campaign.emails.filter((e: { clickedAt: Date | null }) => e.clickedAt).length,
            0
          );
          const openRate = totalEmails > 0 ? totalOpens / totalEmails : 0;
          const clickRate = totalEmails > 0 ? totalClicks / totalEmails : 0;

          return {
            bestDay,
            bestTime,
            confidence,
            nextBestTimes: timeSlots,
            metadata: {
              campaignsAnalyzed: userCampaigns.length,
              totalEmails,
              openRate,
              clickRate,
              timestamp: new Date(),
            },
          };
        },
        86400 // Cache for 24 hours
      );

      logger.info('Generated optimal send time', {
        userId,
        bestDay: result.bestDay,
        bestTime: result.bestTime,
        confidence: result.confidence,
        fromCache,
      });

      return result;
    } catch (error: any) {
      logger.error('Error calculating optimal send time:', {
        error: error.message,
        stack: error.stack,
        userId,
      });
      
      // Fallback to default times if there's an error
      return this.getDefaultOptimalSendTime();
    }
  }

  private getDefaultOptimalSendTime(): OptimalSendTime {
    // Default best practices for email marketing
    return {
      bestDay: 'Tuesday',
      bestTime: '10:00',
      confidence: 75,
      nextBestTimes: [
        { day: 'Thursday', time: '10:00', confidence: 70 },
        { day: 'Wednesday', time: '14:00', confidence: 65 },
      ],
      metadata: {
        campaignsAnalyzed: 0,
        totalEmails: 0,
        openRate: 0,
        clickRate: 0,
        timestamp: new Date(),
      },
    };
  }

  async generateSubjectLineVariations(
    content: string,
    count: number = 3,
    options: {
      tone?: 'professional' | 'casual' | 'urgent' | 'friendly' | 'curious';
      maxLength?: number;
      includeEmojis?: boolean;
    } = {}
  ): Promise<{ subject: string; score: number }[]> {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    const { tone = 'professional', maxLength = 60, includeEmojis = true } = options;
    const cacheKey = `subject_lines_${crypto
      .createHash('md5')
      .update(`${content}_${tone}_${maxLength}_${includeEmojis}`)
      .digest('hex')}`;

    try {
      const { data: variations } = await this.makeCachedApiCall<{ subject: string; score: number }[]>(
        cacheKey,
        async () => {
          const prompt = `Generate ${count} engaging email subject lines for the following content. 
          Tone: ${tone}
          Max length: ${maxLength} characters
          Include emojis: ${includeEmojis ? 'Yes' : 'No'}
          
          Content:
          ${content}
          
          For each subject line, provide a score from 1-10 on how likely it is to get the email opened.
          Format your response as a JSON array of objects with "subject" and "score" properties.`;

          const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: `You are an expert email marketer who creates high-converting subject lines.
                - Keep subject lines under ${maxLength} characters
                - Use title case
                - ${includeEmojis ? 'Include 1-2 relevant emojis when appropriate' : 'Do not use emojis'}
                - Make them attention-grabbing and relevant to the content
                - Avoid spammy words and all caps
                - Vary the approaches (questions, statements, curiosity gaps, etc.)`,
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 500,
            response_format: { type: 'json_object' },
          });

          const result = response.choices[0]?.message?.content || '[]';
          
          try {
            const parsed = JSON.parse(result);
            // Handle both array and object with array property responses
            const variations = Array.isArray(parsed) ? parsed : 
                             parsed.variations || parsed.subjects || [];
            
            // Ensure we return the expected format
            return variations.map((item: any) => ({
              subject: item.subject || item.text || '',
              score: typeof item.score === 'number' ? item.score : 5 // Default to 5 if no score provided
            }));
          } catch (e) {
            logger.error('Failed to parse AI response as JSON:', { result });
            return [];
          }
        },
        3600 // Cache for 1 hour
      );

      return variations;
    } catch (error: any) {
      logger.error('Error generating subject line variations:', {
        error: error.message,
        stack: error.stack,
        contentLength: content?.length || 0,
      });
      throw new Error(`Failed to generate subject line variations: ${error.message}`);
    }
            // Handle both array and object with array property responses
            const variations = Array.isArray(parsed) ? parsed : 
                             parsed.variations || parsed.subjects || [];
            
            // Ensure we return the expected format
            return variations.map((item: any) => ({
              subject: item.subject || item.text || '',
              score: typeof item.score === 'number' ? item.score : 7, // Default score of 7 if missing
            })).filter((item: any) => item.subject && item.subject.length <= maxLength)
               .sort((a: any, b: any) => b.score - a.score)
               .slice(0, count);
          } catch (e) {
            logger.error('Failed to parse subject lines response:', { result, error: e });
            throw new Error('Failed to parse subject lines response');
          }
        },
        3600 // Cache for 1 hour
      );

      logger.info('Generated subject line variations', {
        contentLength: content.length,
        count: variations.length,
        averageScore: variations.reduce((sum, v) => sum + v.score, 0) / variations.length,
      });

      return variations;
    } catch (error: any) {
      logger.error('Error generating subject lines:', {
        error: error.message,
        stack: error.stack,
        contentLength: content?.length || 0,
      });
      
      // Fallback to simple subject lines if AI fails
      return [
        { subject: content.substring(0, Math.min(60, content.length)), score: 5 },
        { subject: `Quick update: ${content.substring(0, Math.min(45, content.length))}...`, score: 5 },
        { subject: `Important: ${content.substring(0, Math.min(50, content.length))}`, score: 5 },
      ].slice(0, count);
    }
  }

  async personalizeContent(
    content: string,
    userData: Record<string, any>,
    options: {
      mergeTags?: boolean;
      preserveFormatting?: boolean;
    } = {}
  ): Promise<{ content: string; personalizations: string[] }> {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    if (!userData || typeof userData !== 'object' || Object.keys(userData).length === 0) {
      return { content, personalizations: [] };
    }

    const { mergeTags = true, preserveFormatting = true } = options;
    const cacheKey = `personalized_${require('crypto')
      .createHash('md5')
      .update(`${content}_${JSON.stringify(userData)}_${mergeTags}_${preserveFormatting}`)
      .digest('hex')}`;

    try {
      const { data: result } = await this.makeCachedApiCall<{ content: string; personalizations: string[] }>(
        cacheKey,
        async () => {
          // Prepare user data for the prompt
          const userDataStr = Object.entries(userData)
            .map(([key, value]) => `- ${key}: ${value}`)
            .join('\n');

          const prompt = `Personalize the following email content for a user with these characteristics:
          
          User data:
          ${userDataStr}
          
          Email content to personalize:
          ${content}
          
          Guidelines:
          1. Keep the same tone and formatting as the original
          2. Only personalize where it makes natural sense
          3. ${mergeTags ? 'Use merge tags like {{firstName}} for dynamic fields' : 'Replace all placeholders with actual values'}
          4. Return a JSON object with "content" and "personalizations" array
          5. List all personalizations made in the "personalizations" array`;

          const response = await this.openai.createChatCompletion({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: `You are an expert at personalizing email content to increase engagement.
                - Maintain the original tone and style
                - Only personalize where it feels natural
                - ${mergeTags ? 'Use double curly braces for merge tags (e.g., {{firstName}})' : 'Replace all placeholders with actual values'}
                - Keep formatting consistent with the original
                - Return a valid JSON object with "content" and "personalizations"`,
                response_format: { type: 'json_object' },
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 2000,
          });

          const result = response.data.choices[0]?.message?.content || '{}';
          
          try {
            const parsed = JSON.parse(result);
            return {
              content: parsed.content || content,
              personalizations: Array.isArray(parsed.personalizations) ? 
                parsed.personalizations : 
                (parsed.personalizations ? [parsed.personalizations] : []),
            };
          } catch (e) {
            logger.error('Failed to parse personalization response:', { result, error: e });
            return { content, personalizations: [] };
          }
        },
        3600 // Cache for 1 hour
      );

      logger.info('Personalized content', {
        contentLength: content.length,
        personalizations: result.personalizations.length,
        hasMergeTags: mergeTags,
      });

      return result;
    } catch (error: any) {
      logger.error('Error personalizing content:', {
        error: error.message,
        stack: error.stack,
        contentLength: content?.length || 0,
      });
      
      // Fallback to simple merge tag replacement if AI fails
      if (mergeTags) {
        let personalizedContent = content;
        const personalizations: string[] = [];
        
        Object.entries(userData).forEach(([key, value]) => {
          const tag = `{{${key}}}`;
          if (content.includes(tag)) {
            personalizedContent = personalizedContent.replace(new RegExp(tag, 'g'), String(value));
            personalizations.push(`Replaced {{${key}}} with user data`);
          }
        });
        
        return { content: personalizedContent, personalizations };
      }
      
      return { content, personalizations: [] };
    }
  }
}

export const aiOptimizationService = AIOptimizationService.getInstance();
