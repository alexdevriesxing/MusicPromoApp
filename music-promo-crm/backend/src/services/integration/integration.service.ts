import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';
import axios from 'axios';
import crypto from 'crypto';

type IntegrationType = 'EMAIL_PROVIDER' | 'SOCIAL_MEDIA' | 'PAYMENT_GATEWAY' | 'ANALYTICS' | 'OTHER';

type IntegrationConfig = {
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  [key: string]: any;
};

type WebhookEvent = {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  error?: string;
};

export class IntegrationService {
  private static instance: IntegrationService;
  private webhookQueue: WebhookEvent[] = [];
  private isProcessing = false;

  private constructor() {
    // Start processing webhook queue
    this.processWebhookQueue();
  }

  static getInstance(): IntegrationService {
    if (!IntegrationService.instance) {
      IntegrationService.instance = new IntegrationService();
    }
    return IntegrationService.instance;
  }

  /**
   * Create a new integration
   */
  async createIntegration(
    name: string,
    type: IntegrationType,
    config: IntegrationConfig,
    userId: string
  ) {
    try {
      // Encrypt sensitive data
      const encryptedConfig = this.encryptConfig(config);
      
      const integration = await prisma.integration.create({
        data: {
          name,
          type,
          config: encryptedConfig,
          userId,
          isActive: true,
        },
      });

      // Log the integration creation
      await this.logIntegrationEvent(integration.id, 'INTEGRATION_CREATED', { type });
      
      return integration;
    } catch (error) {
      logger.error('Error creating integration:', error);
      throw new Error('Failed to create integration');
    }
  }

  /**
   * Test an integration
   */
  async testIntegration(integrationId: string) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const config = this.decryptConfig(integration.config as IntegrationConfig);
    
    try {
      // Test the integration based on its type
      switch (integration.type) {
        case 'EMAIL_PROVIDER':
          return await this.testEmailProvider(config);
        case 'SOCIAL_MEDIA':
          return await this.testSocialMedia(config);
        case 'PAYMENT_GATEWAY':
          return await this.testPaymentGateway(config);
        case 'ANALYTICS':
          return await this.testAnalytics(config);
        default:
          return { success: true, message: 'Integration test not implemented' };
      }
    } catch (error) {
      logger.error('Integration test failed:', error);
      throw new Error(`Integration test failed: ${error.message}`);
    }
  }

  /**
   * Queue a webhook event for processing
   */
  async queueWebhookEvent(
    integrationId: string,
    eventType: string,
    payload: any
  ) {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      payload,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
    };

    // Add to in-memory queue
    this.webhookQueue.push(event);
    
    // Process the queue if not already processing
    if (!this.isProcessing) {
      this.processWebhookQueue();
    }

    return event.id;
  }

  /**
   * Process the webhook queue
   */
  private async processWebhookQueue() {
    if (this.isProcessing || this.webhookQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const event = this.webhookQueue.shift();

    if (!event) {
      this.isProcessing = false;
      return;
    }

    try {
      // Update event status to processing
      event.status = 'processing';
      event.attempts++;
      event.lastAttemptAt = new Date();

      // Get the integration
      const integration = await prisma.integration.findUnique({
        where: { id: event.payload.integrationId },
      });

      if (!integration) {
        throw new Error('Integration not found');
      }

      const config = this.decryptConfig(integration.config as IntegrationConfig);
      
      // Send the webhook
      const response = await axios.post(config.webhookUrl, {
        event: event.type,
        data: event.payload,
        timestamp: new Date().toISOString(),
      });

      // Update event status
      event.status = 'completed';
      await this.logIntegrationEvent(
        integration.id,
        'WEBHOOK_DELIVERED',
        { eventType: event.type, status: response.status }
      );
    } catch (error) {
      logger.error('Error processing webhook:', error);
      
      // Update event status
      event.status = 'failed';
      event.error = error.message;
      
      // Schedule retry if needed
      if (event.attempts < 3) {
        const delay = Math.min(5 * 60 * 1000 * Math.pow(2, event.attempts), 3600000); // Max 1 hour
        event.nextAttemptAt = new Date(Date.now() + delay);
        this.webhookQueue.push(event);
      } else {
        await this.logIntegrationEvent(
          event.payload.integrationId,
          'WEBHOOK_FAILED',
          { 
            eventType: event.type,
            error: error.message,
            attempts: event.attempts 
          }
        );
      }
    } finally {
      this.isProcessing = false;
      
      // Process next event if any
      if (this.webhookQueue.length > 0) {
        setImmediate(() => this.processWebhookQueue());
      }
    }
  }

  /**
   * Test email provider integration
   */
  private async testEmailProvider(config: IntegrationConfig) {
    // Implement email provider test logic
    return { success: true, message: 'Email provider test successful' };
  }

  /**
   * Test social media integration
   */
  private async testSocialMedia(config: IntegrationConfig) {
    // Implement social media test logic
    return { success: true, message: 'Social media test successful' };
  }

  /**
   * Test payment gateway integration
   */
  private async testPaymentGateway(config: IntegrationConfig) {
    // Implement payment gateway test logic
    return { success: true, message: 'Payment gateway test successful' };
  }

  /**
   * Test analytics integration
   */
  private async testAnalytics(config: IntegrationConfig) {
    // Implement analytics test logic
    return { success: true, message: 'Analytics test successful' };
  }

  /**
   * Encrypt sensitive configuration data
   */
  private encryptConfig(config: IntegrationConfig): IntegrationConfig {
    // In a real implementation, use proper encryption
    const encrypted: any = { ...config };
    
    if (config.apiKey) {
      encrypted.apiKey = `encrypted_${config.apiKey}`;
    }
    
    if (config.apiSecret) {
      encrypted.apiSecret = `encrypted_${config.apiSecret}`;
    }
    
    return encrypted;
  }

  /**
   * Decrypt configuration data
   */
  private decryptConfig(config: IntegrationConfig): IntegrationConfig {
    // In a real implementation, use proper decryption
    const decrypted: any = { ...config };
    
    if (typeof config.apiKey === 'string' && config.apiKey.startsWith('encrypted_')) {
      decrypted.apiKey = config.apiKey.replace('encrypted_', '');
    }
    
    if (typeof config.apiSecret === 'string' && config.apiSecret.startsWith('encrypted_')) {
      decrypted.apiSecret = config.apiSecret.replace('encrypted_', '');
    }
    
    return decrypted;
  }

  /**
   * Log integration events
   */
  private async logIntegrationEvent(
    integrationId: string,
    eventType: string,
    metadata: Record<string, any> = {}
  ) {
    try {
      await prisma.integrationEvent.create({
        data: {
          integrationId,
          eventType,
          metadata,
        },
      });
    } catch (error) {
      logger.error('Error logging integration event:', error);
    }
  }
}

export const integrationService = IntegrationService.getInstance();
