import { Request, Response, NextFunction } from 'express';

export class CustomAPIError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface ValidationError {
  message: string;
  field?: string;
  value?: any;
}

export class BadRequestError extends CustomAPIError {
  errors?: ValidationError[];
  
  constructor(message: string, errors?: ValidationError[]) {
    super(message, 400);
    this.errors = errors;
    
    // Set the prototype explicitly (required when extending built-in classes)
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
  
  toJSON() {
    return {
      status: 'error',
      message: this.message,
      errors: this.errors,
    };
  }
}

export class UnauthenticatedError extends CustomAPIError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends CustomAPIError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class NotFoundError extends CustomAPIError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class UnauthorizedError extends CustomAPIError {
  constructor(message: string) {
    super(message, 401);
  }
}

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);
  
  if (err instanceof CustomAPIError) {
    // Use the toJSON method if it exists, otherwise fall back to default
    const errorResponse = 'toJSON' in err ? (err as any).toJSON() : { message: err.message };
    return res.status(err.statusCode).json(errorResponse);
  }

  // Handle mongoose validation errors
  if ((err as any).name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      message: e.message,
      field: e.path,
      value: e.value
    }));
    
    return res.status(400).json({
      status: 'error',
      message: 'Validation Error',
      errors
    });
  }

  // Handle mongoose duplicate key errors
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    return res.status(400).json({
      status: 'error',
      message: `Duplicate field value: ${field}. Please use another value.`,
      field,
      value: (err as any).keyValue[field]
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid token. Please log in again.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Your token has expired. Please log in again.'
    });
  }

  // Default error response
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong. Please try again later.' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
