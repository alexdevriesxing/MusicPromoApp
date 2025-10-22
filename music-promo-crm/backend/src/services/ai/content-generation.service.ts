import { Configuration, OpenAIApi } from 'openai';
import { logger } from '../../utils/logger';
import { prisma } from '../../prisma';

type ContentType = 'social_media_post' | 'blog_post' | 'email' | 'ad_copy' | 'song_description';
type Tone = 'professional' | 'casual' | 'enthusiastic' | 'informative' | 'persuasive';

interface ContentGenerationOptions {
  contentType: ContentType;
  topic: string;
  tone?: Tone;
  targetAudience?: string;
  keywords?: string[];
  length?: 'short' | 'medium' | 'long';
  language?: string;
  brandVoice?: string;
  callToAction?: string;
}

interface ContentOptimizationOptions {
  content: string;
  targetKeywords?: string[];
  seoFocus?: boolean;
  readability?: boolean;
  engagement?: boolean;
  characterLimit?: number;
}

export class AIContentGenerationService {
  private openai: OpenAIApi;
  private static instance: AIContentGenerationService;

  private constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  public static getInstance(): AIContentGenerationService {
    if (!AIContentGenerationService.instance) {
      AIContentGenerationService.instance = new AIContentGenerationService();
    }
    return AIContentGenerationService.instance;
  }

  /**
   * Generate content based on the provided options
   */
  async generateContent(options: ContentGenerationOptions): Promise<{
    content: string;
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }> {
    try {
      const prompt = this.buildPrompt(options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional content creator with expertise in music marketing and promotion.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: this.getMaxTokens(options.length),
      });

      const content = response.data.choices[0]?.message?.content?.trim() || '';
      const usage = response.data.usage;

      // Log the API call
      await this.logContentGeneration({
        ...options,
        prompt,
        response: content,
        model: 'gpt-4',
        tokensUsed: usage?.total_tokens || 0,
        cost: this.calculateCost(usage?.total_tokens || 0, 'gpt-4')
      });

      return {
        content,
        metadata: {
          model: 'gpt-4',
          tokens: usage?.total_tokens || 0,
          timestamp: new Date()
        }
      };
    } catch (error: any) {
      logger.error('Error generating AI content:', error);
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  /**
   * Optimize existing content
   */
  async optimizeContent(options: ContentOptimizationOptions): Promise<{
    optimizedContent: string;
    score: number;
    suggestions: string[];
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }> {
    try {
      const prompt = this.buildOptimizationPrompt(options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional content optimizer with expertise in SEO and engagement.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      const result = response.data.choices[0]?.message?.content?.trim() || '';
      const usage = response.data.usage;

      // Parse the response to extract the optimized content, score, and suggestions
      const { optimizedContent, score, suggestions } = this.parseOptimizationResponse(result);

      return {
        optimizedContent,
        score,
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
   * Generate multiple content variations
   */
  async generateVariations(
    baseContent: string,
    variations: number = 3,
    options: {
      tone?: Tone;
      style?: string;
      length?: 'shorter' | 'same' | 'longer';
    } = {}
  ): Promise<Array<{
    content: string;
    variation: number;
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }>> {
    try {
      const prompt = this.buildVariationPrompt(baseContent, variations, options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a creative content generator that creates variations of the provided content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000,
        n: variations
      });

      const variationsList = response.data.choices.map((choice, index) => ({
        content: choice.message?.content?.trim() || '',
        variation: index + 1,
        metadata: {
          model: 'gpt-4',
          tokens: response.data.usage?.total_tokens || 0,
          timestamp: new Date()
        }
      }));

      return variationsList;
    } catch (error: any) {
      logger.error('Error generating content variations:', error);
      throw new Error(`Failed to generate content variations: ${error.message}`);
    }
  }

  /**
   * Generate hashtags for content
   */
  async generateHashtags(
    content: string,
    platform: 'instagram' | 'twitter' | 'tiktok' | 'all' = 'all',
    count: number = 10
  ): Promise<string[]> {
    try {
      const prompt = `Generate ${count} relevant hashtags for the following content, optimized for ${platform === 'all' ? 'social media' : platform}:

${content}

Format the response as a comma-separated list of hashtags.`;
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a social media expert that generates relevant hashtags.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 100,
      });

      const hashtagsText = response.data.choices[0]?.message?.content?.trim() || '';
      
      // Parse the response to extract hashtags
      const hashtags = hashtagsText
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.startsWith('#'))
        .slice(0, count);

      return hashtags;
    } catch (error: any) {
      logger.error('Error generating hashtags:', error);
      throw new Error(`Failed to generate hashtags: ${error.message}`);
    }
  }

  /**
   * Generate an image based on a text prompt
   */
  async generateImage(
    prompt: string,
    options: {
      size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
      quality?: 'standard' | 'hd';
      style?: 'vivid' | 'natural';
    } = {}
  ): Promise<{
    url: string;
    revisedPrompt?: string;
    metadata: {
      model: string;
      size: string;
      timestamp: Date;
    };
  }> {
    try {
      const response = await this.openai.createImage({
        prompt: this.enhanceImagePrompt(prompt, options),
        n: 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        style: options.style || 'vivid',
        response_format: 'url',
      });

      const imageUrl = response.data.data[0]?.url;
      const revisedPrompt = response.data.data[0]?.revised_prompt;

      if (!imageUrl) {
        throw new Error('No image URL returned from the API');
      }

      return {
        url: imageUrl,
        revisedPrompt,
        metadata: {
          model: 'dall-e-3',
          size: options.size || '1024x1024',
          timestamp: new Date()
        }
      };
    } catch (error: any) {
      logger.error('Error generating image:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  /**
   * Generate video script based on content
   */
  async generateVideoScript(
    content: string,
    options: {
      duration?: number; // in seconds
      style?: 'explainer' | 'tutorial' | 'storytelling' | 'promotional';
      includeVisuals?: boolean;
    } = {}
  ): Promise<{
    script: string;
    scenes: Array<{
      sceneNumber: number;
      description: string;
      visualDescription?: string;
      duration: number;
      narration: string;
    }>;
    metadata: {
      model: string;
      tokens: number;
      timestamp: Date;
    };
  }> {
    try {
      const prompt = this.buildVideoScriptPrompt(content, options);
      
      const response = await this.openai.createChatCompletion({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional video scriptwriter with expertise in creating engaging video content.'
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
      const usage = response.data.usage;

      // Parse the response to extract the script and scenes
      const { script, scenes } = this.parseVideoScriptResponse(result);

      return {
        script,
        scenes,
        metadata: {
          model: 'gpt-4',
          tokens: usage?.total_tokens || 0,
          timestamp: new Date()
        }
      };
    } catch (error: any) {
      logger.error('Error generating video script:', error);
      throw new Error(`Failed to generate video script: ${error.message}`);
    }
  }

  /**
   * Private helper methods
   */

  private buildPrompt(options: ContentGenerationOptions): string {
    const {
      contentType,
      topic,
      tone = 'professional',
      targetAudience = 'music lovers',
      keywords = [],
      length = 'medium',
      language = 'English',
      brandVoice = 'friendly and professional',
      callToAction = ''
    } = options;

    const lengthMap = {
      short: '2-3 sentences',
      medium: '1-2 paragraphs',
      long: '3-5 paragraphs'
    };

    const contentTypes = {
      social_media_post: 'a social media post',
      blog_post: 'a blog post',
      email: 'an email',
      ad_copy: 'an advertisement copy',
      song_description: 'a song description'
    };

    return `Create ${contentTypes[contentType as keyof typeof contentTypes] || 'content'} about "${topic}".

Requirements:
- Tone: ${tone}
- Target audience: ${targetAudience}
- Length: ${lengthMap[length as keyof typeof lengthMap]}
- Language: ${language}
- Brand voice: ${brandVoice}
${keywords.length > 0 ? `- Include these keywords: ${keywords.join(', ')}\n` : ''}${callToAction ? `- Include a call to action: ${callToAction}\n` : ''}
Make the content engaging, original, and tailored to the specified requirements.`;
  }

  private buildOptimizationPrompt(options: ContentOptimizationOptions): string {
    const {
      content,
      targetKeywords = [],
      seoFocus = true,
      readability = true,
      engagement = true,
      characterLimit
    } = options;

    return `Optimize the following content based on the given requirements:

${content}

Optimization requirements:
${targetKeywords.length > 0 ? `- Target keywords: ${targetKeywords.join(', ')}\n` : ''}${seoFocus ? '- Improve SEO optimization\n' : ''}${readability ? '- Enhance readability\n' : ''}${engagement ? '- Increase engagement\n' : ''}${characterLimit ? `- Keep it under ${characterLimit} characters\n` : ''}
Provide the optimized content, a score from 1-10, and specific suggestions for improvement. Format your response as follows:

OPTIMIZED CONTENT:
[The optimized content here]

SCORE: [score]/10

SUGGESTIONS:
- [Suggestion 1]
- [Suggestion 2]
...`;
  }

  private buildVariationPrompt(
    baseContent: string,
    variations: number,
    options: {
      tone?: Tone;
      style?: string;
      length?: 'shorter' | 'same' | 'longer';
    } = {}
  ): string {
    const { tone, style, length = 'same' } = options;
    
    let lengthInstruction = '';
    if (length === 'shorter') lengthInstruction = 'Make it more concise.';
    else if (length === 'longer') lengthInstruction = 'Expand on the content with more details.';
    
    return `Create ${variations} distinct variations of the following content. Each variation should maintain the core message but present it differently.

Original content:
${baseContent}

Requirements for variations:
${tone ? `- Tone: ${tone}\n` : ''}${style ? `- Style: ${style}\n` : ''}${lengthInstruction ? `- ${lengthInstruction}\n` : ''}
Format your response as a numbered list of variations, with each variation clearly labeled.`;
  }

  private enhanceImagePrompt(prompt: string, options: any): string {
    // Add style and quality enhancements to the prompt
    let enhancedPrompt = prompt;
    
    // Add quality and style instructions
    if (options.quality === 'hd') {
      enhancedPrompt = `High-definition, detailed, professional photography: ${enhancedPrompt}`;
    }
    
    if (options.style === 'natural') {
      enhancedPrompt += ' Natural lighting, realistic style.';
    } else {
      enhancedPrompt += ' Vivid colors, dynamic composition.';
    }
    
    // Add general improvements
    enhancedPrompt += ' 8K, high resolution, professional photography, sharp focus.';
    
    return enhancedPrompt;
  }

  private buildVideoScriptPrompt(
    content: string,
    options: {
      duration?: number;
      style?: string;
      includeVisuals?: boolean;
    } = {}
  ): string {
    const { duration = 60, style = 'explainer', includeVisuals = true } = options;
    
    return `Create a video script based on the following content. The video should be approximately ${duration} seconds long and follow a ${style} style.

Content:
${content}

Format your response as follows:

SCRIPT OVERVIEW:
[A brief summary of the video script]

SCENES:
1. [Scene 1 description]
   - Visual: [Description of visuals for scene 1]
   - Duration: [duration in seconds]s
   - Narration: [Narration text for scene 1]

2. [Scene 2 description]
   - Visual: [Description of visuals for scene 2]
   - Duration: [duration in seconds]s
   - Narration: [Narration text for scene 2]

... and so on for all scenes.

Total duration: ${duration} seconds

${includeVisuals ? 'Include detailed visual descriptions for each scene.' : 'Focus on the script and narration.'}`;
  }

  private parseOptimizationResponse(response: string): {
    optimizedContent: string;
    score: number;
    suggestions: string[];
  } {
    // Extract the optimized content
    const optimizedContentMatch = response.match(/OPTIMIZED CONTENT:[\s\n]+([\s\S]+?)(?:\n\n|$)/i);
    const optimizedContent = optimizedContentMatch ? optimizedContentMatch[1].trim() : response;
    
    // Extract the score
    const scoreMatch = response.match(/SCORE:\s*(\d+(?:\.\d+)?)\/10/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
    
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
      score,
      suggestions
    };
  }

  private parseVideoScriptResponse(response: string): {
    script: string;
    scenes: Array<{
      sceneNumber: number;
      description: string;
      visualDescription?: string;
      duration: number;
      narration: string;
    }>;
  } {
    // Extract the script overview
    const scriptOverviewMatch = response.match(/SCRIPT OVERVIEW:[\s\n]+([\s\S]+?)(?:\n\nSCENES:|$)/i);
    const script = scriptOverviewMatch ? scriptOverviewMatch[1].trim() : '';
    
    // Extract all scenes
    const scenes: Array<{
      sceneNumber: number;
      description: string;
      visualDescription?: string;
      duration: number;
      narration: string;
    }> = [];
    
    const sceneRegex = /(\d+)\.\s*([^\n]+)\s*\n\s*Visual:\s*([^\n]+)\s*\n\s*Duration:\s*(\d+)s\s*\n\s*Narration:\s*([\s\S]+?)(?=\n\d+\.|$)/gi;
    
    let sceneMatch;
    while ((sceneMatch = sceneRegex.exec(response)) !== null) {
      scenes.push({
        sceneNumber: parseInt(sceneMatch[1]),
        description: sceneMatch[2].trim(),
        visualDescription: sceneMatch[3]?.trim(),
        duration: parseInt(sceneMatch[4]),
        narration: sceneMatch[5].trim()
      });
    }
    
    return {
      script,
      scenes
    };
  }

  private getMaxTokens(length: string = 'medium'): number {
    const lengthMap: Record<string, number> = {
      short: 150,
      medium: 300,
      long: 600
    };
    
    return lengthMap[length] || 300;
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

  private async logContentGeneration(data: {
    contentType: string;
    topic: string;
    tone?: string;
    targetAudience?: string;
    prompt: string;
    response: string;
    model: string;
    tokensUsed: number;
    cost: number;
  }): Promise<void> {
    try {
      await prisma.aIContentGenerationLog.create({
        data: {
          contentType: data.contentType,
          topic: data.topic,
          tone: data.tone,
          targetAudience: data.targetAudience,
          prompt: data.prompt,
          response: data.response,
          model: data.model,
          tokensUsed: data.tokensUsed,
          cost: data.cost,
          metadata: {}
        }
      });
    } catch (error) {
      logger.error('Failed to log AI content generation:', error);
    }
  }
}

export const aiContentGenerationService = AIContentGenerationService.getInstance();
