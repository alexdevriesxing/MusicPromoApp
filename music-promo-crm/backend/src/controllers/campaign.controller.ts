import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import campaignService from '../services/campaign.service';
import { BadRequestError } from '../errors';

export const createCampaign = async (req: Request, res: Response) => {
  const userId = req.user?.userId as string;
  const campaign = await campaignService.createCampaign(userId, req.body);
  
  res.status(StatusCodes.CREATED).json({
    status: 'success',
    data: {
      campaign,
    },
  });
};

export const getCampaign = async (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = await campaignService.getCampaignById(id);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      campaign,
    },
  });
};

export const updateCampaign = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId as string;
  
  const campaign = await campaignService.updateCampaign(id, userId, req.body);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      campaign,
    },
  });
};

export const deleteCampaign = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.userId as string;
  
  await campaignService.deleteCampaign(id, userId);
  
  res.status(StatusCodes.NO_CONTENT).send();
};

export const listCampaigns = async (req: Request, res: Response) => {
  const userId = req.user?.userId as string;
  const { status, page, limit, sort } = req.query;
  
  const statusArray = status ? (Array.isArray(status) ? status : [status]) : undefined;
  
  const { campaigns, total } = await campaignService.listCampaigns(userId, {
    status: statusArray as string[],
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    sort: sort as string,
  });
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    results: campaigns.length,
    total,
    data: {
      campaigns,
    },
  });
};

export const prepareCampaignRecipients = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tags, statuses, countries } = req.body;
  
  const result = await campaignService.prepareCampaignRecipients(id, {
    tags,
    statuses,
    countries,
  });
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      recipients: result,
    },
  });
};

export const getCampaignStats = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const stats = await campaignService.getCampaignStats(id);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      stats,
    },
  });
};

export const updateCampaignStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user?.userId as string;
  
  if (!status) {
    throw new BadRequestError('Status is required');
  }
  
  const campaign = await campaignService.updateCampaign(id, userId, { status });
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    data: {
      campaign,
    },
  });
};

export const getCampaignRecipients = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, page = 1, limit = 20 } = req.query;
  
  const campaign = await campaignService.getCampaignById(id);
  
  let recipients = campaign.recipients;
  
  // Filter by status if provided
  if (status) {
    recipients = recipients.filter(recipient => recipient.status === status);
  }
  
  // Pagination
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = pageNum * limitNum;
  
  const paginatedRecipients = recipients.slice(startIndex, endIndex);
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    pagination: {
      total: recipients.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(recipients.length / limitNum),
    },
    data: {
      recipients: paginatedRecipients,
    },
  });
};

export const sendTestEmail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email } = req.body;
  
  if (!email) {
    throw new BadRequestError('Email is required');
  }
  
  // In a real implementation, this would send a test email
  // For now, we'll just return a success response
  
  res.status(StatusCodes.OK).json({
    status: 'success',
    message: 'Test email sent successfully',
    data: {
      campaignId: id,
      email,
    },
  });
};
