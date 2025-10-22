import { Router } from 'express';
import * as emailTemplateController from '../controllers/email-template.controller';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validate-request';
import {
  createTemplateValidation,
  updateTemplateValidation,
  templateIdValidation,
  listTemplatesValidation,
  duplicateTemplateValidation,
} from '../validations/email-template.validation';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Email Template routes
router.post(
  '/',
  createTemplateValidation,
  validateRequest,
  emailTemplateController.createTemplate
);

router.get(
  '/',
  listTemplatesValidation,
  validateRequest,
  emailTemplateController.listTemplates
);

router.get(
  '/categories',
  emailTemplateController.getTemplateCategories
);

router.get(
  '/default',
  emailTemplateController.getDefaultTemplate
);

router.get(
  '/:id',
  templateIdValidation,
  validateRequest,
  emailTemplateController.getTemplate
);

router.patch(
  '/:id',
  updateTemplateValidation,
  validateRequest,
  emailTemplateController.updateTemplate
);

router.delete(
  '/:id',
  templateIdValidation,
  validateRequest,
  emailTemplateController.deleteTemplate
);

router.post(
  '/:id/duplicate',
  duplicateTemplateValidation,
  validateRequest,
  emailTemplateController.duplicateTemplate
);

export default router;
