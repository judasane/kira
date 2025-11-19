import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { createRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { config } from './config';

export function createApp(prisma: PrismaClient): Application {
  const app = express();

  // ============================================================================
  // Basic middleware
  // ============================================================================

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  // ============================================================================
  // Routes
  // ============================================================================

  // API routes (prefixed with /api according to swagger, or without prefix)
  // According to swagger, routes are at /payment-links, /webhooks/psp, etc.
  // without the /api prefix
  app.use('/', createRouter(prisma));

  // ============================================================================
  // Error handling
  // ============================================================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}
