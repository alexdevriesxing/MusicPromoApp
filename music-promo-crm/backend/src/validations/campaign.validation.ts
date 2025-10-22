import { body, param, query } from 'express-validator';
import { ContactStatus } from '../types/contact.types';

const validStatuses = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'] as const;
const validRecipientStatuses = ['pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'] as const;

export const createCampaignValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ max: 100 })
    .withMessage('Campaign name cannot be more than 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),

  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Email subject is required')
    .isLength({ max: 200 })
    .withMessage('Subject cannot be more than 200 characters'),

  body('fromEmail')
    .trim()
    .notEmpty()
    .withMessage('From email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('fromName')
    .trim()
    .notEmpty()
    .withMessage('From name is required')
    .isLength({ max: 100 })
    .withMessage('From name cannot be more than 100 characters'),

  body('replyTo')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid reply-to email address')
    .normalizeEmail(),

  body('template.subject')
    .trim()
    .notEmpty()
    .withMessage('Template subject is required')
    .isLength({ max: 200 })
    .withMessage('Template subject cannot be more than 200 characters'),

  body('template.body')
    .notEmpty()
    .withMessage('Template body is required'),

  body('template.variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),

  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format. Use ISO 8601 format')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),

  body('recipientFilter.tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('recipientFilter.statuses')
    .optional()
    .isArray()
    .withMessage('Statuses must be an array')
    .custom((statuses) => {
      if (Array.isArray(statuses)) {
        const validStatuses: ContactStatus[] = ['active', 'inactive', 'lead', 'customer', 'influencer'];
        for (const status of statuses) {
          if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
          }
        }
      }
      return true;
    }),

  body('recipientFilter.countries')
    .optional()
    .isArray()
    .withMessage('Countries must be an array'),
];

export const updateCampaignValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid campaign ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Campaign name cannot be more than 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),

  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject cannot be more than 200 characters'),

  body('fromEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('fromName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('From name cannot be more than 100 characters'),

  body('replyTo')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid reply-to email address')
    .normalizeEmail(),

  body('template.subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Template subject cannot be more than 200 characters'),

  body('template.body')
    .optional()
    .notEmpty()
    .withMessage('Template body cannot be empty'),

  body('status')
    .optional()
    .isIn(validStatuses)
    .withMessage(`Status must be one of: ${validStatuses.join(', ')}`),

  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format. Use ISO 8601 format')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Scheduled date must be in the future');
      }
      return true;
    }),
];

export const campaignIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
];

export const listCampaignsValidation = [
  query('status')
    .optional()
    .isArray()
    .withMessage('Status must be an array')
    .custom((statuses) => {
      if (Array.isArray(statuses)) {
        for (const status of statuses) {
          if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
          }
        }
      }
      return true;
    }),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('sort')
    .optional()
    .trim()
    .matches(/^-?[a-zA-Z]+$/)
    .withMessage('Invalid sort format. Use field name with optional - prefix for descending'),
];

export const prepareRecipientsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid campaign ID'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('statuses')
    .optional()
    .isArray()
    .withMessage('Statuses must be an array')
    .custom((statuses) => {
      if (Array.isArray(statuses)) {
        const validStatuses: ContactStatus[] = ['active', 'inactive', 'lead', 'customer', 'influencer'];
        for (const status of statuses) {
          if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}`);
          }
        }
      }
      return true;
    }),

  body('countries')
    .optional()
    .isArray()
    .withMessage('Countries must be an array'),
];

export const recipientStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid campaign ID'),

  param('status')
    .isIn(validRecipientStatuses)
    .withMessage(`Status must be one of: ${validRecipientStatuses.join(', ')}`),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];
