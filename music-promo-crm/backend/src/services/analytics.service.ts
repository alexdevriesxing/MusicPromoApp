import { prisma } from '../prisma';
import { logger } from '../utils/logger';

export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getCampaignAnalytics(campaignId: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          emails: {
            select: {
              id: true,
              status: true,
              sentAt: true,
              openedAt: true,
              clickedAt: true,
              recipientId: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const totalEmails = campaign.emails.length;
      const delivered = campaign.emails.filter(e => e.status === 'DELIVERED').length;
      const opened = campaign.emails.filter(e => e.openedAt).length;
      const clicked = campaign.emails.filter(e => e.clickedAt).length;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        totalEmails,
        delivered,
        opened,
        clicked,
        deliveryRate: totalEmails > 0 ? (delivered / totalEmails) * 100 : 0,
        openRate: totalEmails > 0 ? (opened / totalEmails) * 100 : 0,
        clickRate: totalEmails > 0 ? (clicked / totalEmails) * 100 : 0,
        ctr: opened > 0 ? (clicked / opened) * 100 : 0,
        timeline: this.generateTimelineData(campaign.emails),
      };
    } catch (error) {
      logger.error('Error getting campaign analytics:', error);
      throw error;
    }
  }

  private generateTimelineData(emails: any[]) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const timeline: Record<string, { sent: number; opened: number; clicked: number }> = {};
    
    // Initialize timeline with empty data for last 30 days
    for (let i = 0; i <= 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      timeline[dateStr] = { sent: 0, opened: 0, clicked: 0 };
    }

    // Process emails
    emails.forEach(email => {
      const sentDate = email.sentAt ? new Date(email.sentAt).toISOString().split('T')[0] : null;
      const openedDate = email.openedAt ? new Date(email.openedAt).toISOString().split('T')[0] : null;
      const clickedDate = email.clickedAt ? new Date(email.clickedAt).toISOString().split('T')[0] : null;

      if (sentDate && timeline[sentDate]) {
        timeline[sentDate].sent += 1;
      }
      
      if (openedDate && timeline[openedDate]) {
        timeline[openedDate].opened += 1;
      }
      
      if (clickedDate && timeline[clickedDate]) {
        timeline[clickedDate].clicked += 1;
      }
    });

    return Object.entries(timeline).map(([date, data]) => ({
      date,
      ...data,
    }));
  }

  async getUserEngagement(userId: string) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const userCampaigns = await prisma.campaign.findMany({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          emails: {
            select: {
              status: true,
              openedAt: true,
              clickedAt: true,
            },
          },
        },
      });

      const totalCampaigns = userCampaigns.length;
      const totalEmails = userCampaigns.reduce((sum, campaign) => sum + campaign.emails.length, 0);
      const totalOpened = userCampaigns.flatMap(c => c.emails).filter(e => e.openedAt).length;
      const totalClicked = userCampaigns.flatMap(c => c.emails).filter(e => e.clickedAt).length;

      return {
        userId,
        totalCampaigns,
        totalEmails,
        totalOpened,
        totalClicked,
        avgOpenRate: totalEmails > 0 ? (totalOpened / totalEmails) * 100 : 0,
        avgClickRate: totalEmails > 0 ? (totalClicked / totalEmails) * 100 : 0,
        ctr: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
        campaignPerformance: userCampaigns.map(campaign => ({
          campaignId: campaign.id,
          campaignName: campaign.name,
          sent: campaign.emails.length,
          opened: campaign.emails.filter(e => e.openedAt).length,
          clicked: campaign.emails.filter(e => e.clickedAt).length,
        })),
      };
    } catch (error) {
      logger.error('Error getting user engagement:', error);
      throw error;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
