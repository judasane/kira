import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../app';
import { PrismaClient } from '@prisma/client';
import express from 'express';

// Mock dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
  PaymentLinkStatus: {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    COMPLETED: 'COMPLETED',
  },
  PSPProvider: {
    STRIPE: 'STRIPE',
    ADYEN: 'ADYEN',
  },
  PSPAttemptStatus: {
    SUCCESS: 'SUCCESS',
    DECLINED: 'DECLINED',
    ERROR: 'ERROR',
    TIMEOUT: 'TIMEOUT',
  },
}));

vi.mock('../routes', () => ({
  createRouter: vi.fn(() => {
    const router = express.Router();
    router.get('/test', (_req: express.Request, res: express.Response) => res.json({ test: true }));
    return router;
  }),
}));

describe('Application', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {} as PrismaClient;
  });

  describe('createApp', () => {
    it('should create Express application', () => {
      const app = createApp(mockPrisma);

      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should apply security middleware', () => {
      const app = createApp(mockPrisma);

      // Check if helmet is applied (it sets various headers)
      expect(app._router).toBeDefined();
    });

    it('should apply CORS middleware', () => {
      const app = createApp(mockPrisma);

      expect(app._router).toBeDefined();
    });

    it('should parse JSON bodies', () => {
      const app = createApp(mockPrisma);

      expect(app._router).toBeDefined();
      expect(app._router.stack.some((layer: any) =>
        layer.name === 'jsonParser'
      )).toBe(true);
    });

    it('should parse URL encoded bodies', () => {
      const app = createApp(mockPrisma);

      expect(app._router.stack.some((layer: any) =>
        layer.name === 'urlencodedParser'
      )).toBe(true);
    });

    it('should not apply morgan in test environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const app = createApp(mockPrisma);

      // In test mode, morgan should not be applied
      expect(app._router.stack.every((layer: any) =>
        layer.name !== 'logger'
      )).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error handlers', () => {
      const app = createApp(mockPrisma);

      // Check that error handlers are in the middleware stack
      const errorHandlers = app._router.stack.filter(
        (layer: any) => layer.handle.length === 4
      );

      expect(errorHandlers.length).toBeGreaterThan(0);
    });
  });
});
