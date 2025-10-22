import { Configuration, OpenAIApi } from 'openai';
import { logger } from '../../utils/logger';
import { prisma } from '../../prisma';

type OptimizationType = 'seo' | 'readability' | 'engagement' | 'conversion' | 'tone';
type ContentType = 'blog_post' | 'social_media' | 'email' | 'ad_copy' | 'landing_page';

export class AIOptimizationService {
  private openai: OpenAIApi;
  private static instance: AIOptimizationService;

  private constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  public static getInstance(): AIOptimizationService {
    if (!AIOptimizationService.instance) {
      AIOptimizationService.instance = new AIOptimizationService();
    }
    return AIOptimizationService.instance;
  }

  /**
   * Optimize content based on specific criteria
   */
  async optimizeContent(
    content: string,
    type: OptimizationType,
    options: {
      targetKeywords?: string[];
      targetAudience?: string;
      contentType?: ContentType;
      tone?: string;
      characterLimit?: number;
      additionalInstructions?: string;
    } = {}
  ): Promise<{
    optimizedContent: string;
    score: {
      before: number;
      after: number;
      improvement: number;
    };
    suggestions: string[];
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }> {
    try {
      const prompt = this.buildOptimizationPrompt(content, type, options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional content optimizer with expertise in various optimization techniques.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });

      const result = response.data.choices[0]?.message?.content?.trim() || '';
      const usage = response.data.usage;

      // Parse the response to extract the optimized content, score, and suggestions
      const { optimizedContent, beforeScore, afterScore, suggestions } = 
        this.parseOptimizationResponse(result, content);

      // Log the optimization
      await this.logOptimization({
        originalContent: content,
        optimizedContent,
        optimizationType: type,
        contentType: options.contentType,
        targetKeywords: options.targetKeywords,
        model: 'gpt-4',
        tokensUsed: usage?.total_tokens || 0,
        cost: this.calculateCost(usage?.total_tokens || 0, 'gpt-4'),
        metadata: {
          beforeScore,
          afterScore,
          improvement: afterScore - beforeScore,
          suggestions
        }
      });

      return {
        optimizedContent,
        score: {
          before: beforeScore,
          after: afterScore,
          improvement: afterScore - beforeScore
        },
        suggestions,
        metadata: {
          model: 'gpt-4',
          tokens: usage?.total_tokens || 0,
          timestamp: new Date()
        }
      };
    } catch (error: any) {
      logger.error('Error optimizing content:', error);
      throw new Error(`Failed to optimize content: ${error.message}`);
    }
  }

  /**
   * Perform A/B testing on different content variations
   */
  async performABTest(
    variations: Array<{
      content: string;
      variationName: string;
      metadata?: Record<string, any>;
    }>,
    testCriteria: {
      goal: 'click_through' | 'conversion' | 'engagement' | 'retention';
      targetAudience?: string;
      sampleSize?: number;
      durationDays?: number;
    }
  ): Promise<{
    winner: string;
    confidence: number;
    results: Array<{
      variationName: string;
      score: number;
      improvement: number;
      metrics: Record<string, any>;
    }>;
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }> {
    try {
      if (variations.length < 2) {
        throw new Error('At least two variations are required for A/B testing');
      }

      const prompt = this.buildABTestPrompt(variations, testCriteria);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in A/B testing and content optimization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const result = response.data.choices[0]?.message?.content?.trim() || '';
      const usage = response.data.usage;

      // Parse the A/B test results
      const abTestResults = this.parseABTestResponse(result, variations.length);

      // Log the A/B test
      await this.logABTest({
        variations: variations.map((v, i) => ({
          name: v.variationName,
          content: v.content,
          score: abTestResults.results[i]?.score || 0,
          improvement: abTestResults.results[i]?.improvement || 0,
          metrics: abTestResults.results[i]?.metrics || {}
        })),
        testCriteria,
        winner: abTestResults.winner,
        confidence: abTestResults.confidence,
        model: 'gpt-4',
        tokensUsed: usage?.total_tokens || 0,
        cost: this.calculateCost(usage?.total_tokens || 0, 'gpt-4')
      });

      return {
        ...abTestResults,
        metadata: {
          model: 'gpt-4',
          tokens: usage?.total_tokens || 0,
          timestamp: new Date()
        }
      };
    } catch (error: any) {
      logger.error('Error performing A/B test:', error);
      throw new Error(`Failed to perform A/B test: ${error.message}`);
    }
  }

  /**
   * Analyze content performance and provide insights
   */
  async analyzeContentPerformance(
    content: string,
    metrics: Record<string, any>,
    options: {
      contentType?: ContentType;
      targetAudience?: string;
      comparisonData?: Array<{
        content: string;
        metrics: Record<string, any>;
      }>;
    } = {}
  ): Promise<{
    insights: string[];
    recommendations: string[];
    score: number;
    metricsAnalysis: Record<string, any>;
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }> {
    try {
      const prompt = this.buildAnalysisPrompt(content, metrics, options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a content performance analyst with expertise in interpreting content metrics.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const result = response.data.choices[0]?.message?.content?.trim() || '';
      const usage = response.data.usage;

      // Parse the analysis results
      const { insights, recommendations, score, metricsAnalysis } = 
        this.parseAnalysisResponse(result);

      // Log the analysis
      await this.logContentAnalysis({
        content,
        contentType: options.contentType,
        metrics,
        insights,
        recommendations,
        score,
        model: 'gpt-4',
        tokensUsed: usage?.total_tokens || 0,
        cost: this.calculateCost(usage?.total_tokens || 0, 'gpt-4')
      });

      return {
        insights,
        recommendations,
        score,
        metricsAnalysis,
        metadata: {
          model: 'gpt-4',
          tokens: usage?.total_tokens || 0,
          timestamp: new Date()
        }
      };
    } catch (error: any) {
      logger.error('Error analyzing content performance:', error);
      throw new Error(`Failed to analyze content performance: ${error.message}`);
    }
  }

  /**
   * Generate content variations for testing
   */
  async generateOptimizationVariations(
    content: string,
    optimizationType: OptimizationType,
    count: number = 3,
    options: {
      targetKeywords?: string[];
      targetAudience?: string;
      contentType?: ContentType;
    } = {}
  ): Promise<Array<{
    variation: string;
    explanation: string;
    expectedImprovement: number;
  }>> {
    try {
      const prompt = this.buildVariationPrompt(content, optimizationType, count, options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a content optimization expert that generates effective content variations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const result = response.data.choices[0]?.message?.content?.trim() || '';
      
      // Parse the variations from the response
      return this.parseVariationResponse(result, count);
    } catch (error: any) {
      logger.error('Error generating optimization variations:', error);
      throw new Error(`Failed to generate optimization variations: ${error.message}`);
    }
  }

  /**
   * Private helper methods
   */

  private buildOptimizationPrompt(
    content: string,
    type: OptimizationType,
    options: {
      targetKeywords?: string[];
      targetAudience?: string;
      contentType?: ContentType;
      tone?: string;
      characterLimit?: number;
      additionalInstructions?: string;
    } = {}
  ): string {
    const {
      targetKeywords = [],
      targetAudience = 'general audience',
      contentType = 'content',
      tone = 'professional',
      characterLimit,
      additionalInstructions = ''
    } = options;

    const optimizationFocus = {
      seo: 'improve search engine optimization',
      readability: 'enhance readability',
      engagement: 'increase engagement',
      conversion: 'boost conversion rates',
      tone: 'adjust the tone',
    }[type] || 'optimize the content';

    return `I need to ${optimizationFocus} for the following ${contentType}.

Content:"""
${content}
"""

Target audience: ${targetAudience}
${targetKeywords.length > 0 ? `Target keywords: ${targetKeywords.join(', ')}\n` : ''}${tone ? `Tone: ${tone}\n` : ''}${characterLimit ? `Character limit: ${characterLimit}\n` : ''}${additionalInstructions ? `Additional instructions: ${additionalInstructions}\n` : ''}
Please provide:
1. An optimized version of the content
2. A score from 1-10 for the original content
3. A score from 1-10 for the optimized content
4. Specific suggestions for improvement

Format your response as follows:

OPTIMIZED CONTENT:
[The optimized content here]

ORIGINAL SCORE: [score]/10
OPTIMIZED SCORE: [score]/10
IMPROVEMENT: [+X%]

SUGGESTIONS:
- [Suggestion 1]
- [Suggestion 2]
...`;
  }

  private buildABTestPrompt(
    variations: Array<{ content: string; variationName: string }>,
    testCriteria: {
      goal: string;
      targetAudience?: string;
      sampleSize?: number;
      durationDays?: number;
    }
  ): string {
    const { goal, targetAudience = 'general audience', sampleSize, durationDays } = testCriteria;

    let prompt = `I'm conducting an A/B test with the following variations for ${targetAudience}. The goal is to ${goal}.

`;

    variations.forEach((variation, index) => {
      prompt += `--- VARIATION ${index + 1} (${variation.variationName}) ---\n${variation.content}\n\n`;
    });

    prompt += `\nPlease analyze these variations and provide:\n`;
    prompt += `1. A score from 1-10 for each variation based on its potential to achieve the goal\n`;
    prompt += `2. The predicted winner and confidence level (low/medium/high)\n`;
    prompt += `3. A brief explanation for each score\n`;
    prompt += `4. Key metrics to track for each variation\n\n`;
    prompt += `Format your response as follows:\n\n`;
    prompt += `WINNER: [Variation Name]\n`;
    prompt += `CONFIDENCE: [low/medium/high]\n\n`;
    prompt += `RESULTS:\n`;
    prompt += `1. [Variation 1 Name]\n   Score: X/10\n   Explanation: [Brief explanation]\n   Key Metrics: [List of key metrics]\n\n`;
    prompt += `2. [Variation 2 Name]\n   Score: X/10\n   Explanation: [Brief explanation]\n   Key Metrics: [List of key metrics]\n\n`;
    prompt += `[Continue for all variations]`;

    return prompt;
  }

  private buildAnalysisPrompt(
    content: string,
    metrics: Record<string, any>,
    options: {
      contentType?: string;
      targetAudience?: string;
      comparisonData?: Array<{
        content: string;
        metrics: Record<string, any>;
      }>;
    } = {}
  ): string {
    const { contentType = 'content', targetAudience = 'general audience', comparisonData } = options;

    let prompt = `Analyze the performance of the following ${contentType} for ${targetAudience}.\n\n`;
    prompt += `CONTENT:\n${content}\n\n`;
    prompt += `PERFORMANCE METRICS:\n${JSON.stringify(metrics, null, 2)}\n\n`;

    if (comparisonData && comparisonData.length > 0) {
      prompt += `COMPARISON DATA:\n`;
      comparisonData.forEach((item, index) => {
        prompt += `--- COMPARISON ${index + 1} ---\n`;
        prompt += `CONTENT:\n${item.content}\n\n`;
        prompt += `METRICS:\n${JSON.stringify(item.metrics, null, 2)}\n\n`;
      });
    }

    prompt += `Please provide:\n`;
    prompt += `1. Key insights from the performance data\n`;
    prompt += `2. Actionable recommendations for improvement\n`;
    prompt += `3. An overall performance score from 1-10\n`;
    prompt += `4. Analysis of key metrics and what they mean\n\n`;
    prompt += `Format your response as follows:\n\n`;
    prompt += `INSIGHTS:\n- [Insight 1]\n- [Insight 2]\n...\n\n`;
    prompt += `RECOMMENDATIONS:\n- [Recommendation 1]\n- [Recommendation 2]\n...\n\n`;
    prompt += `OVERALL SCORE: X/10\n\n`;
    prompt += `METRICS ANALYSIS:\n[Detailed analysis of key metrics]`;

    return prompt;
  }

  private buildVariationPrompt(
    content: string,
    optimizationType: string,
    count: number,
    options: {
      targetKeywords?: string[];
      targetAudience?: string;
      contentType?: string;
    } = {}
  ): string {
    const { targetKeywords = [], targetAudience = 'general audience', contentType = 'content' } = options;

    const optimizationFocus = {
      seo: 'search engine optimization',
      readability: 'readability',
      engagement: 'engagement',
      conversion: 'conversion rates',
      tone: 'tone adjustment',
    }[optimizationType] || 'optimization';

    return `Generate ${count} distinct variations of the following ${contentType} to improve ${optimizationFocus} for ${targetAudience}.

Original Content:"""
${content}
"""

${targetKeywords.length > 0 ? `Target keywords: ${targetKeywords.join(', ')}\n` : ''}
For each variation, please provide:
1. The variation content
2. A brief explanation of the changes made
3. The expected improvement (low/medium/high)

Format your response as follows:

VARIATION 1:
[Content]

EXPLANATION: [Explanation of changes]
EXPECTED IMPROVEMENT: [low/medium/high]

---

VARIATION 2:
[Content]

EXPLANATION: [Explanation of changes]
EXPECTED IMPROVEMENT: [low/medium/high]

[Continue for all variations]`;
  }

  private parseOptimizationResponse(
    response: string,
    originalContent: string
  ): {
    optimizedContent: string;
    beforeScore: number;
    afterScore: number;
    suggestions: string[];
  } {
    // Extract the optimized content
    const optimizedContentMatch = response.match(/OPTIMIZED CONTENT:[\s\n]+([\s\S]+?)(?:\n\n|$)/i);
    const optimizedContent = optimizedContentMatch ? optimizedContentMatch[1].trim() : response;
    
    // Extract the scores
    const beforeScoreMatch = response.match(/ORIGINAL SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
    const afterScoreMatch = response.match(/OPTIMIZED SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
    
    const beforeScore = beforeScoreMatch ? parseFloat(beforeScoreMatch[1]) : 0;
    const afterScore = afterScoreMatch ? parseFloat(afterScoreMatch[1]) : 0;
    
    // Extract suggestions
    const suggestionsMatch = response.match(/SUGGESTIONS:[\s\n]+([\s\S]+)/i);
    let suggestions: string[] = [];
    
    if (suggestionsMatch) {
      suggestions = suggestionsMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*[-*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
    
    return {
      optimizedContent,
      beforeScore,
      afterScore,
      suggestions
    };
  }

  private parseABTestResponse(
    response: string,
    variationCount: number
  ): {
    winner: string;
    confidence: number;
    results: Array<{
      variationName: string;
      score: number;
      improvement: number;
      metrics: Record<string, any>;
    }>;
  } {
    // Extract the winner
    const winnerMatch = response.match(/WINNER:\s*(.+)/i);
    const winner = winnerMatch ? winnerMatch[1].trim() : '';
    
    // Extract confidence level
    const confidenceMatch = response.match(/CONFIDENCE:\s*(low|medium|high)/i);
    const confidenceLevel = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';
    const confidenceMap: Record<string, number> = { low: 0.3, medium: 0.6, high: 0.9 };
    const confidence = confidenceMap[confidenceLevel] || 0.5;
    
    // Extract results for each variation
    const results: Array<{
      variationName: string;
      score: number;
      improvement: number;
      metrics: Record<string, any>;
    }> = [];
    
    for (let i = 1; i <= variationCount; i++) {
      const variationRegex = new RegExp(`${i}\.\s*([^\n]+)\s*\n\s*Score:\s*(\d+(?:\.\d+)?)\/10\s*\n\s*Explanation:[\s\S]+?Key Metrics:([\s\S]+?)(?=\n\d+\.|$)`, 'i');
      
      const variationMatch = response.match(variationRegex);
      
      if (variationMatch) {
        const variationName = variationMatch[1].trim();
        const score = parseFloat(variationMatch[2]) || 0;
        const metricsText = variationMatch[3].trim();
        
        // Parse metrics (simplified - in a real app, you'd want more robust parsing)
        const metrics: Record<string, any> = {};
        const metricLines = metricsText.split('\n').map(line => line.trim()).filter(line => line);
        
        metricLines.forEach(line => {
          const [key, ...valueParts] = line.split(':').map(part => part.trim());
          if (key && valueParts.length > 0) {
            metrics[key] = valueParts.join(':').trim();
          }
        });
        
        results.push({
          variationName,
          score,
          improvement: 0, // This would be calculated based on comparison
          metrics
        });
      }
    }
    
    // Calculate improvement percentages
    if (results.length > 0) {
      const maxScore = Math.max(...results.map(r => r.score));
      results.forEach(result => {
        result.improvement = maxScore > 0 ? (result.score / maxScore - 1) * 100 : 0;
      });
    }
    
    return {
      winner,
      confidence,
      results
    };
  }

  private parseAnalysisResponse(
    response: string
  ): {
    insights: string[];
    recommendations: string[];
    score: number;
    metricsAnalysis: Record<string, any>;
  } {
    // Extract insights
    const insightsMatch = response.match(/INSIGHTS:[\s\n]+([\s\S]+?)(?:\n\n|$)/i);
    const insights = insightsMatch
      ? insightsMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*[-*]\s*/, '').trim())
          .filter(line => line.length > 0)
      : [];
    
    // Extract recommendations
    const recommendationsMatch = response.match(/RECOMMENDATIONS:[\s\n]+([\s\S]+?)(?:\n\n|$)/i);
    const recommendations = recommendationsMatch
      ? recommendationsMatch[1]
          .split('\n')
          .map(line => line.replace(/^\s*[-*]\s*/, '').trim())
          .filter(line => line.length > 0)
      : [];
    
    // Extract score
    const scoreMatch = response.match(/OVERALL SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
    
    // Extract metrics analysis (simplified)
    const metricsMatch = response.match(/METRICS ANALYSIS:[\s\n]+([\s\S]+)/i);
    const metricsAnalysis: Record<string, any> = {
      summary: metricsMatch ? metricsMatch[1].trim() : ''
    };
    
    return {
      insights,
      recommendations,
      score,
      metricsAnalysis
    };
  }

  private parseVariationResponse(
    response: string,
    expectedCount: number
  ): Array<{
    variation: string;
    explanation: string;
    expectedImprovement: number;
  }> {
    const variations: Array<{
      variation: string;
      explanation: string;
      expectedImprovement: number;
    }> = [];
    
    // Split the response into individual variation blocks
    const variationBlocks = response.split(/---*\s*\n/).filter(block => block.trim());
    
    for (let i = 0; i < Math.min(variationBlocks.length, expectedCount); i++) {
      const block = variationBlocks[i];
      
      // Extract variation content
      const contentMatch = block.match(/VARIATION \d+:?\s*\n([\s\S]+?)(?:\n\n|$)/i);
      const variation = contentMatch ? contentMatch[1].trim() : '';
      
      // Extract explanation
      const explanationMatch = block.match(/EXPLANATION:\s*([^\n]+)/i);
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';
      
      // Extract expected improvement
      const improvementMatch = block.match(/EXPECTED IMPROVEMENT:\s*(low|medium|high)/i);
      const improvementText = improvementMatch ? improvementMatch[1].toLowerCase() : 'medium';
      const improvementMap: Record<string, number> = { low: 1, medium: 2, high: 3 };
      const expectedImprovement = improvementMap[improvementText] || 2;
      
      variations.push({
        variation,
        explanation,
        expectedImprovement
      });
    }
    
    return variations;
  }

  private calculateCost(tokens: number, model: string): number {
    // Cost per 1K tokens (in USD)
    const costPer1K: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-32k': { input: 0.06, output: 0.12 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'dall-e-3': { input: 0.04, output: 0 } // Per image
    };
    
    const modelCost = costPer1K[model] || { input: 0.002, output: 0.002 };
    return (tokens / 1000) * (modelCost.input + modelCost.output);
  }

  private async logOptimization(data: {
    originalContent: string;
    optimizedContent: string;
    optimizationType: string;
    contentType?: string;
    targetKeywords?: string[];
    model: string;
    tokensUsed: number;
    cost: number;
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      await prisma.aIOptimizationLog.create({
        data: {
          originalContent: data.originalContent,
          optimizedContent: data.optimizedContent,
          optimizationType: data.optimizationType,
          contentType: data.contentType,
          targetKeywords: data.targetKeywords,
          model: data.model,
          tokensUsed: data.tokensUsed,
          cost: data.cost,
          metadata: data.metadata
        }
      });
    } catch (error) {
      logger.error('Failed to log AI optimization:', error);
    }
  }

  private async logABTest(data: {
    variations: Array<{
      name: string;
      content: string;
      score: number;
      improvement: number;
      metrics: Record<string, any>;
    }>;
    testCriteria: Record<string, any>;
    winner: string;
    confidence: number;
    model: string;
    tokensUsed: number;
    cost: number;
  }): Promise<void> {
    try {
      await prisma.aIABTestLog.create({
        data: {
          variations: data.variations,
          testCriteria: data.testCriteria,
          winner: data.winner,
          confidence: data.confidence,
          model: data.model,
          tokensUsed: data.tokensUsed,
          cost: data.cost
        }
      });
    } catch (error) {
      logger.error('Failed to log AI A/B test:', error);
    }
  }

  private async logContentAnalysis(data: {
    content: string;
    contentType?: string;
    metrics: Record<string, any>;
    insights: string[];
    recommendations: string[];
    score: number;
    model: string;
    tokensUsed: number;
    cost: number;
  }): Promise<void> {
    try {
      await prisma.aIContentAnalysisLog.create({
        data: {
          content: data.content,
          contentType: data.contentType,
          metrics: data.metrics,
          insights: data.insights,
          recommendations: data.recommendations,
          score: data.score,
          model: data.model,
          tokensUsed: data.tokensUsed,
          cost: data.cost
        }
      });
    } catch (error) {
      logger.error('Failed to log content analysis:', error);
    }
  }
}

export const aiOptimizationService = AIOptimizationService.getInstance();
