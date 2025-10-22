import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { BadRequestError } from '../errors';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: ValidationError) => ({
      message: error.msg,
      field: error.param,
      value: error.value,
    }));
    
    throw new BadRequestError('Validation failed', formattedErrors);
  }
  
  next();
};

export default validateRequest;
