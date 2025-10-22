import { body, param, query } from 'express-validator';
import { ContactStatus, VerificationStatus } from '../types/contact.types';

export const createContactValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot be more than 50 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot be more than 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),

  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name cannot be more than 100 characters'),

  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Position cannot be more than 100 characters'),

  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required'),

  body('city').optional().trim(),
  body('address').optional().trim(),
  body('postalCode').optional().trim(),

  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid URL'),

  body('socialMedia')
    .optional()
    .isArray()
    .withMessage('Social media must be an array'),

  body('socialMedia.*.platform')
    .if(body('socialMedia').exists())
    .isIn(['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other'])
    .withMessage('Invalid social media platform'),

  body('socialMedia.*.url')
    .if(body('socialMedia').exists())
    .isURL()
    .withMessage('Please provide a valid URL'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot be more than 30 characters'),

  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .isLength({ max: 1000 })
    .withMessage('Notes cannot be more than 1000 characters'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'lead', 'customer', 'influencer'])
    .withMessage('Invalid status'),
];

export const updateContactValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contact ID'),
  
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot be more than 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot be more than 50 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),

  body('company')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name cannot be more than 100 characters'),

  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Position cannot be more than 100 characters'),

  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid URL'),

  body('socialMedia')
    .optional()
    .isArray()
    .withMessage('Social media must be an array'),

  body('socialMedia.*.platform')
    .if(body('socialMedia').exists())
    .isIn(['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other'])
    .withMessage('Invalid social media platform'),

  body('socialMedia.*.url')
    .if(body('socialMedia').exists())
    .isURL()
    .withMessage('Please provide a valid URL'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ max: 30 })
    .withMessage('Each tag cannot be more than 30 characters'),

  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
    .isLength({ max: 1000 })
    .withMessage('Notes cannot be more than 1000 characters'),

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'lead', 'customer', 'influencer'])
    .withMessage('Invalid status'),

  body('verificationStatus')
    .optional()
    .isIn(['unverified', 'pending', 'verified', 'failed'])
    .withMessage('Invalid verification status'),

  body('isFavorite')
    .optional()
    .isBoolean()
    .withMessage('isFavorite must be a boolean'),
];

export const contactIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contact ID'),
];

export const getContactsValidation = [
  query('search').optional().trim(),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'lead', 'customer', 'influencer'])
    .withMessage('Invalid status'),
    
  query('verificationStatus')
    .optional()
    .isIn(['unverified', 'pending', 'verified', 'failed'])
    .withMessage('Invalid verification status'),
    
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        return value.split(',').every(tag => tag.trim().length > 0);
      }
      return false;
    })
    .withMessage('Tags must be a comma-separated list'),
    
  query('country').optional().trim(),
  
  query('isFavorite')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isFavorite must be either true or false'),
    
  query('sort')
    .optional()
    .trim()
    .matches(/^-?[a-zA-Z]+$/)
    .withMessage('Sort must be a valid field'),
    
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

export const verifyContactValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid contact ID'),
    
  body('status')
    .isIn(['pending', 'verified', 'failed'])
    .withMessage('Invalid verification status'),
];
