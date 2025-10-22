import mongoose, { Types } from 'mongoose';
import Campaign, { ICampaign, ICampaignRecipient } from '../models/campaign.model';
import Contact, { IContact } from '../models/contact.model';
import { BadRequestError, NotFoundError } from '../errors';
import { ContactStatus } from '../types/contact.types';

interface CreateCampaignData {
  name: string;
  description?: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  template: {
    subject: string;
    body: string;
    variables: string[];
  };
  scheduledAt?: Date;
  recipientFilter?: {
    tags?: string[];
    statuses?: ContactStatus[];
    countries?: string[];
  };
}

interface UpdateCampaignData extends Partial<CreateCampaignData> {
  status?: 'draft' | 'scheduled' | 'paused' | 'cancelled';
}

interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  openRate: number;
  clickRate: number;
}

class CampaignService {
  async createCampaign(userId: string, data: CreateCampaignData): Promise<ICampaign> {
    const campaignData = {
      ...data,
      status: data.scheduledAt ? 'scheduled' : 'draft',
      createdBy: userId,
      updatedBy: userId,
      stats: this.initializeStats(),
    };

    const campaign = await Campaign.create(campaignData);
    return campaign;
  }

  async updateCampaign(
    campaignId: string,
    userId: string,
    data: UpdateCampaignData
  ): Promise<ICampaign | null> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    // Prevent certain updates based on campaign status
    if (['sending', 'sent', 'cancelled'].includes(campaign.status)) {
      throw new BadRequestError(`Cannot update a ${campaign.status} campaign`);
    }

    // Handle status transitions
    if (data.status) {
      this.validateStatusTransition(campaign.status, data.status);
      
      if (data.status === 'scheduled' && !data.scheduledAt) {
        throw new BadRequestError('Scheduled time is required for scheduled campaigns');
      }
    }

    const updateData = {
      ...data,
      updatedBy: userId,
    };

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      campaignId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return updatedCampaign;
  }

  async getCampaignById(campaignId: string): Promise<ICampaign> {
    const campaign = await Campaign.findById(campaignId)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    
    return campaign;
  }

  async listCampaigns(
    userId: string,
    options: {
      status?: string[];
      page?: number;
      limit?: number;
      sort?: string;
    } = {}
  ): Promise<{ campaigns: ICampaign[]; total: number }> {
    const { status, page = 1, limit = 10, sort = '-createdAt' } = options;
    
    const query: any = { createdBy: userId };
    
    if (status && status.length > 0) {
      query.status = { $in: status };
    }
    
    const campaigns = await Campaign.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
      
    const total = await Campaign.countDocuments(query);
    
    return { campaigns, total };
  }

  async deleteCampaign(campaignId: string, userId: string): Promise<void> {
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    
    if (campaign.status === 'sending') {
      throw new BadRequestError('Cannot delete a campaign that is currently sending');
    }
    
    await Campaign.findByIdAndDelete(campaignId);
  }

  async prepareCampaignRecipients(
    campaignId: string,
    filter: {
      tags?: string[];
      statuses?: ContactStatus[];
      countries?: string[];
    }
  ): Promise<{ count: number }> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.status !== 'draft') {
      throw new BadRequestError('Cannot update recipients for a campaign that is not in draft status');
    }

    // Build the query based on filters
    const contactQuery: any = { status: 'active' };
    
    if (filter.tags && filter.tags.length > 0) {
      contactQuery.tags = { $in: filter.tags };
    }
    
    if (filter.statuses && filter.statuses.length > 0) {
      contactQuery.status = { $in: filter.statuses };
    }
    
    if (filter.countries && filter.countries.length > 0) {
      contactQuery.country = { $in: filter.countries };
    }

    // Get the contacts that match the filter
    const contacts = await Contact.find(contactQuery, '_id email').lean();
    
    // Create recipient records
    const recipients: ICampaignRecipient[] = contacts.map(contact => {
      // Cast the contact._id to string first, then create ObjectId
      const contactId = new mongoose.Types.ObjectId(String(contact._id));
      return {
        contactId,
        email: contact.email,
        status: 'pending' as const,
      };
    });

    // Update the campaign with the new recipients
    campaign.recipients = recipients;
    campaign.recipientFilter = filter;
    await campaign.save();

    return { count: recipients.length };
  }

  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    
    return campaign.stats;
  }

  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      draft: ['scheduled', 'cancelled'],
      scheduled: ['paused', 'cancelled'],
      paused: ['scheduled', 'cancelled'],
      sending: ['paused', 'cancelled'],
      sent: [],
      cancelled: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestError(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private initializeStats(): CampaignStats {
    return {
      total: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      failed: 0,
      openRate: 0,
      clickRate: 0,
    };
  }
}

export default new CampaignService();
