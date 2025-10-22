import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import xss from 'xss-clean';
import morgan from 'morgan';
import { errorHandlerMiddleware } from './errors';
import authRouter from './routes/auth.routes';
import contactRouter from './routes/contact.routes';
import campaignRouter from './routes/campaign.routes';
import emailTemplateRouter from './routes/email-template.routes';
import analyticsRouter from './routes/analytics.routes';
import aiOptimizationRouter from './routes/ai-optimization.routes';
import specs from './config/swagger';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Security middleware
app.use(helmet()); // Set security HTTP headers
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API Documentation
app.use('/api-docs', 
  swaggerUi.serve, 
  swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Music Promo CRM API',
  })
);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/email-templates', emailTemplateRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiOptimizationRouter);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API documentation in JSON format
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    status: 'error',
    message: 'Not Found',
    path: req.originalUrl,
  });
});

// Error handler
app.use(errorHandlerMiddleware);

export default app;
