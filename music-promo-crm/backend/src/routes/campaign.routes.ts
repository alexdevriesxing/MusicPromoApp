import { Router } from 'express';
import * as campaignController from '../controllers/campaign.controller';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate-request';
import {
  createCampaignValidation,
  updateCampaignValidation,
  campaignIdValidation,
  listCampaignsValidation,
  prepareRecipientsValidation,
  recipientStatusValidation,
} from '../validations/campaign.validation';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Campaign routes
router.post(
  '/',
  createCampaignValidation,
  validateRequest,
  campaignController.createCampaign
);

router.get(
  '/',
  listCampaignsValidation,
  validateRequest,
  campaignController.listCampaigns
);

router.get(
  '/:id',
  campaignIdValidation,
  validateRequest,
  campaignController.getCampaign
);

router.patch(
  '/:id',
  updateCampaignValidation,
  validateRequest,
  campaignController.updateCampaign
);

delete router.patch;

router.delete(
  '/:id',
  campaignIdValidation,
  validateRequest,
  campaignController.deleteCampaign
);

// Campaign recipients
router.post(
  '/:id/recipients/prepare',
  prepareRecipientsValidation,
  validateRequest,
  campaignController.prepareCampaignRecipients
);

router.get(
  '/:id/recipients',
  campaignIdValidation,
  validateRequest,
  campaignController.getCampaignRecipients
);

// Campaign status
router.patch(
  '/:id/status',
  campaignIdValidation,
  validateRequest,
  campaignController.updateCampaignStatus
);

// Campaign stats
router.get(
  '/:id/stats',
  campaignIdValidation,
  validateRequest,
  campaignController.getCampaignStats
);

// Test campaign
router.post(
  '/:id/test',
  campaignIdValidation,
  validateRequest,
  campaignController.sendTestEmail
);

export default router;
