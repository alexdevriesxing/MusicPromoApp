import { prisma } from '../../prisma';
import { logger } from '../../utils/logger';
import { integrationService } from '../integration/integration.service';

type TriggerType = 'EVENT' | 'SCHEDULE' | 'WEBHOOK' | 'MANUAL';
type ActionType = 'SEND_EMAIL' | 'UPDATE_CONTACT' | 'ADD_TAG' | 'CALL_WEBHOOK' | 'DELAY';

type TriggerConfig = {
  eventName?: string;
  schedule?: string; // CRON expression
  webhookPath?: string;
  conditions?: Record<string, any>;
};

type ActionConfig = {
  templateId?: string;
  contactField?: string;
  tag?: string;
  webhookUrl?: string;
  webhookPayload?: Record<string, any>;
  delaySeconds?: number;
};

type AutomationRule = {
  id: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig: TriggerConfig;
  actions: {
    type: ActionType;
    config: ActionConfig;
    order: number;
  }[];
  isActive: boolean;
  userId: string;
};

export class AutomationService {
  private static instance: AutomationService;
  private runningAutomations: Set<string> = new Set();

  private constructor() {
    // Initialize any required services
  }

  static getInstance(): AutomationService {
    if (!AutomationService.instance) {
      AutomationService.instance = new AutomationService();
    }
    return AutomationService.instance;
  }

  /**
   * Create a new automation rule
   */
  async createAutomationRule(ruleData: Omit<AutomationRule, 'id'>) {
    try {
      const rule = await prisma.automationRule.create({
        data: {
          name: ruleData.name,
          description: ruleData.description,
          triggerType: ruleData.triggerType,
          triggerConfig: ruleData.triggerConfig as any,
          actions: ruleData.actions as any[],
          isActive: ruleData.isActive,
          userId: ruleData.userId,
        },
      });

      await this.logAutomationEvent(rule.id, 'RULE_CREATED', { userId: ruleData.userId });
      return rule;
    } catch (error) {
      logger.error('Error creating automation rule:', error);
      throw new Error('Failed to create automation rule');
    }
  }

  /**
   * Execute an automation rule
   */
  async executeRule(ruleId: string, triggerData: Record<string, any> = {}) {
    // Prevent concurrent execution of the same rule
    if (this.runningAutomations.has(ruleId)) {
      logger.warn(`Automation rule ${ruleId} is already running`);
      return;
    }

    try {
      this.runningAutomations.add(ruleId);
      
      const rule = await prisma.automationRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule || !rule.isActive) {
        return;
      }

      await this.logAutomationEvent(ruleId, 'RULE_TRIGGERED', { triggerData });

      // Execute actions in order
      const actions = (rule.actions as any[]).sort((a, b) => a.order - b.order);
      
      for (const action of actions) {
        try {
          await this.executeAction(action, triggerData);
          await this.logAutomationEvent(ruleId, 'ACTION_EXECUTED', { 
            actionType: action.type,
            success: true 
          });
        } catch (error) {
          logger.error(`Error executing action ${action.type}:`, error);
          await this.logAutomationEvent(ruleId, 'ACTION_FAILED', { 
            actionType: action.type,
            error: error.message,
            success: false 
          });
          
          // Continue with next action even if one fails
          continue;
        }
      }

      await this.logAutomationEvent(ruleId, 'RULE_COMPLETED');
    } catch (error) {
      logger.error(`Error executing automation rule ${ruleId}:`, error);
      await this.logAutomationEvent(ruleId, 'RULE_FAILED', { 
        error: error.message,
        success: false 
      });
    } finally {
      this.runningAutomations.delete(ruleId);
    }
  }

  /**
   * Execute a single automation action
   */
  private async executeAction(
    action: { type: ActionType; config: ActionConfig },
    context: Record<string, any>
  ) {
    const { type, config } = action;

    switch (type) {
      case 'SEND_EMAIL':
        return this.sendEmail(config, context);
      case 'UPDATE_CONTACT':
        return this.updateContact(config, context);
      case 'ADD_TAG':
        return this.addTag(config, context);
      case 'CALL_WEBHOOK':
        return this.callWebhook(config, context);
      case 'DELAY':
        return this.delay(config);
      default:
        throw new Error(`Unsupported action type: ${type}`);
    }
  }

  private async sendEmail(config: ActionConfig, context: Record<string, any>) {
    // In a real implementation, integrate with your email service
    const { templateId, contactField = 'email' } = config;
    const recipient = context[contactField];
    
    if (!recipient) {
      throw new Error('No recipient specified for email');
    }

    logger.info(`Sending email to ${recipient} using template ${templateId}`);
    // Actual email sending logic would go here
  }

  private async updateContact(config: ActionConfig, context: Record<string, any>) {
    const { contactField, webhookPayload } = config;
    const contactId = context.contactId;
    
    if (!contactId) {
      throw new Error('No contact ID provided for update');
    }

    // In a real implementation, update the contact in your database
    logger.info(`Updating contact ${contactId} with data:`, webhookPayload);
  }

  private async addTag(config: ActionConfig, context: Record<string, any>) {
    const { tag } = config;
    const contactId = context.contactId;
    
    if (!contactId) {
      throw new Error('No contact ID provided for tagging');
    }

    if (!tag) {
      throw new Error('No tag specified');
    }

    // In a real implementation, add the tag to the contact
    logger.info(`Adding tag "${tag}" to contact ${contactId}`);
  }

  private async callWebhook(config: ActionConfig, context: Record<string, any>) {
    const { webhookUrl, webhookPayload } = config;
    
    if (!webhookUrl) {
      throw new Error('No webhook URL specified');
    }

    // In a real implementation, make an HTTP request to the webhook
    logger.info(`Calling webhook ${webhookUrl} with data:`, webhookPayload);
    
    // Example using fetch (you might want to use axios or another HTTP client)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...webhookPayload,
        timestamp: new Date().toISOString(),
        context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`);
    }
  }

  private delay(config: ActionConfig): Promise<void> {
    const { delaySeconds = 0 } = config;
    return new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  }

  /**
   * Log automation events
   */
  private async logAutomationEvent(
    ruleId: string,
    eventType: string,
    metadata: Record<string, any> = {}
  ) {
    try {
      await prisma.automationEvent.create({
        data: {
          ruleId,
          eventType,
          metadata,
        },
      });
    } catch (error) {
      logger.error('Error logging automation event:', error);
    }
  }
}

export const automationService = AutomationService.getInstance();
