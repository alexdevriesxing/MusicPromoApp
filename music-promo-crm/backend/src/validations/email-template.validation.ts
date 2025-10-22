import { body, param, query } from 'express-validator';

export const createTemplateValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name cannot be more than 100 characters'),

  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Email subject is required')
    .isLength({ max: 200 })
    .withMessage('Subject cannot be more than 200 characters'),

  body('body')
    .notEmpty()
    .withMessage('Template body is required'),

  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),

  body('previewText')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Preview text cannot be more than 255 characters'),

  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category cannot be more than 50 characters'),

  body('thumbnail')
    .optional()
    .trim()
    .isURL()
    .withMessage('Thumbnail must be a valid URL'),
];

export const updateTemplateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Template name cannot be more than 100 characters'),

  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject cannot be more than 200 characters'),

  body('body')
    .optional()
    .notEmpty()
    .withMessage('Template body cannot be empty'),

  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),

  body('previewText')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Preview text cannot be more than 255 characters'),

  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category cannot be more than 50 characters'),

  body('thumbnail')
    .optional()
    .trim()
    .isURL()
    .withMessage('Thumbnail must be a valid URL'),
];

export const templateIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),
];

export const listTemplatesValidation = [
  query('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Category cannot be more than 50 characters'),

  query('isDefault')
    .optional()
    .isBoolean()
    .withMessage('isDefault must be a boolean'),

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

export const duplicateTemplateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid template ID'),

  body('name')
    .trim()
    .notEmpty()
    .withMessage('Template name is required')
    .isLength({ max: 100 })
    .withMessage('Template name cannot be more than 100 characters'),
];
