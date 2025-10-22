import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export class AnalyticsService {
  private prisma: PrismaClient;
  private static instance: AnalyticsService;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignPerformance(
    userId: string,
    dateRange: DateRange,
    filters: {
      campaignId?: string;
      platform?: string;
      status?: string[];
    } = {}
  ) {
    try {
      const { startDate, endDate } = dateRange;
      
      const where: Prisma.CampaignWhereInput = {
        userId,
        createdAt: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      };

      if (filters.campaignId) {
        where.id = filters.campaignId;
      }

      if (filters.platform) {
        where.platform = filters.platform;
      }

      if (filters.status?.length) {
        where.status = { in: filters.status };
      }

      const campaigns = await this.prisma.campaign.findMany({
        where,
        include: {
          metrics: true,
          events: {
            where: {
              createdAt: {
                gte: startOfDay(startDate),
                lte: endOfDay(endDate),
              },
            },
          },
        },
      });

      // Calculate metrics
      return campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        platform: campaign.platform,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        spend: campaign.metrics?.spend || 0,
        impressions: campaign.metrics?.impressions || 0,
        clicks: campaign.metrics?.clicks || 0,
        conversions: campaign.metrics?.conversions || 0,
        ctr: campaign.metrics?.clicks && campaign.metrics?.impressions 
          ? (campaign.metrics.clicks / campaign.metrics.impressions) * 100 
          : 0,
        cpc: campaign.metrics?.clicks && campaign.metrics?.spend 
          ? campaign.metrics.spend / campaign.metrics.clicks 
          : 0,
        cpa: campaign.metrics?.conversions && campaign.metrics?.spend 
          ? campaign.metrics.spend / campaign.metrics.conversions 
          : 0,
        events: campaign.events,
      }));
    } catch (error) {
      logger.error('Error getting campaign performance:', error);
      throw new Error('Failed to get campaign performance');
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagement(
    userId: string,
    dateRange: DateRange,
    filters: {
      userSegment?: string;
      actionType?: string;
    } = {}
  ) {
    try {
      const { startDate, endDate } = dateRange;
      
      const where: any = {
        userId,
        timestamp: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      };

      if (filters.userSegment) {
        where.userSegment = filters.userSegment;
      }

      if (filters.actionType) {
        where.actionType = filters.actionType;
      }

      // Get user actions
      const actions = await this.prisma.userAction.findMany({
        where,
        orderBy: {
          timestamp: 'asc',
        },
      });

      // Group by date
      const dateMap = new Map<string, any>();
      const dateRangeArray = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Initialize date map with 0 values
      dateRangeArray.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        dateMap.set(dateStr, {
          date: dateStr,
          totalActions: 0,
          uniqueUsers: new Set<string>(),
          actionsByType: new Map<string, number>(),
        });
      });

      // Process actions
      actions.forEach(action => {
        const dateStr = format(action.timestamp, 'yyyy-MM-dd');
        const dayData = dateMap.get(dateStr);
        
        if (dayData) {
          dayData.totalActions++;
          dayData.uniqueUsers.add(action.userId);
          
          const actionType = action.actionType;
          dayData.actionsByType.set(
            actionType,
            (dayData.actionsByType.get(actionType) || 0) + 1
          );
        }
      });

      // Convert to array format
      return Array.from(dateMap.values()).map(dayData => ({
        date: dayData.date,
        totalActions: dayData.totalActions,
        uniqueUsers: dayData.uniqueUsers.size,
        actionsByType: Object.fromEntries(dayData.actionsByType),
      }));
    } catch (error) {
      logger.error('Error getting user engagement:', error);
      throw new Error('Failed to get user engagement');
    }
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(
    userId: string,
    dateRange: DateRange,
    filters: {
      source?: string;
      productId?: string;
    } = {}
  ) {
    try {
      const { startDate, endDate } = dateRange;
      
      const where: any = {
        userId,
        status: 'COMPLETED',
        completedAt: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      };

      if (filters.source) {
        where.source = filters.source;
      }

      if (filters.productId) {
        where.productId = filters.productId;
      }

      const transactions = await this.prisma.transaction.findMany({
        where,
        orderBy: {
          completedAt: 'asc',
        },
      });

      // Group by date
      const dateMap = new Map<string, any>();
      const dateRangeArray = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Initialize date map with 0 values
      dateRangeArray.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        dateMap.set(dateStr, {
          date: dateStr,
          totalRevenue: 0,
          transactionCount: 0,
          averageOrderValue: 0,
          bySource: new Map<string, number>(),
          byProduct: new Map<string, number>(),
        });
      });

      // Process transactions
      transactions.forEach(transaction => {
        const dateStr = format(transaction.completedAt, 'yyyy-MM-dd');
        const dayData = dateMap.get(dateStr);
        
        if (dayData) {
          dayData.totalRevenue += transaction.amount;
          dayData.transactionCount++;
          dayData.averageOrderValue = dayData.totalRevenue / dayData.transactionCount;
          
          // Group by source
          const source = transaction.source || 'unknown';
          dayData.bySource.set(
            source,
            (dayData.bySource.get(source) || 0) + transaction.amount
          );
          
          // Group by product
          if (transaction.productId) {
            dayData.byProduct.set(
              transaction.productId,
              (dayData.byProduct.get(transaction.productId) || 0) + transaction.amount
            );
          }
        }
      });

      // Convert to array format
      return Array.from(dateMap.values()).map(dayData => ({
        date: dayData.date,
        totalRevenue: dayData.totalRevenue,
        transactionCount: dayData.transactionCount,
        averageOrderValue: dayData.averageOrderValue,
        bySource: Object.fromEntries(dayData.bySource),
        byProduct: Object.fromEntries(dayData.byProduct),
      }));
    } catch (error) {
      logger.error('Error getting revenue metrics:', error);
      throw new Error('Failed to get revenue metrics');
    }
  }

  /**
   * Generate a custom report
   */
  async generateCustomReport(
    userId: string,
    reportType: string,
    dateRange: DateRange,
    filters: Record<string, any> = {},
    options: {
      includeCharts?: boolean;
      format?: 'json' | 'csv' | 'pdf';
    } = {}
  ) {
    try {
      let reportData: any;

      switch (reportType) {
        case 'campaign-performance':
          reportData = await this.getCampaignPerformance(userId, dateRange, filters);
          break;
        case 'user-engagement':
          reportData = await this.getUserEngagement(userId, dateRange, filters);
          break;
        case 'revenue':
          reportData = await this.getRevenueMetrics(userId, dateRange, filters);
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Format the report based on the requested format
      switch (options.format) {
        case 'csv':
          return this.convertToCsv(reportData);
        case 'pdf':
          return this.generatePdf(reportData, reportType, dateRange);
        default:
          return {
            success: true,
            data: reportData,
            metadata: {
              generatedAt: new Date(),
              reportType,
              dateRange,
              filters,
              includeCharts: options.includeCharts || false,
            },
          };
      }
    } catch (error) {
      logger.error(`Error generating ${reportType} report:`, error);
      throw new Error(`Failed to generate ${reportType} report`);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCsv(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
      headers.map(header => {
        const value = item[header];
        // Handle nested objects and arrays
        if (typeof value === 'object' && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generate PDF report
   */
  private async generatePdf(
    data: any[], 
    reportType: string, 
    dateRange: DateRange
  ): Promise<Buffer> {
    // This is a placeholder implementation
    // In a real app, you would use a library like pdfkit, puppeteer, or a report generation service
    logger.info(`Generating PDF report for ${reportType}`);
    
    // Simulate PDF generation
    return Buffer.from('PDF report content would be generated here');
  }

  /**
   * Schedule a recurring report
   */
  async scheduleReport(
    userId: string,
    reportType: string,
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      timeOfDay: string; // e.g., '09:00'
      recipients: string[];
      format: 'json' | 'csv' | 'pdf';
    },
    filters: Record<string, any> = {},
    options: {
      includeCharts?: boolean;
      emailSubject?: string;
      emailBody?: string;
    } = {}
  ) {
    try {
      // In a real implementation, you would use a job scheduler like node-schedule or bull
      // This is a simplified version that just saves the schedule
      const scheduledReport = await this.prisma.scheduledReport.create({
        data: {
          userId,
          reportType,
          schedule,
          filters,
          options,
          isActive: true,
          nextRunAt: this.calculateNextRun(schedule.frequency, schedule.timeOfDay),
        },
      });

      return scheduledReport;
    } catch (error) {
      logger.error('Error scheduling report:', error);
      throw new Error('Failed to schedule report');
    }
  }

  /**
   * Calculate the next run time for a scheduled report
   */
  private calculateNextRun(
    frequency: 'daily' | 'weekly' | 'monthly',
    timeOfDay: string
  ): Date {
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const now = new Date();
    const nextRun = new Date();
    
    nextRun.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for the next occurrence
    if (nextRun <= now) {
      if (frequency === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (frequency === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7);
      } else if (frequency === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
    }
    
    return nextRun;
  }
}

export const analyticsService = AnalyticsService.getInstance();
