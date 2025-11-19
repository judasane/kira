import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Controller for service healthcheck.
 * Verifies the service status and database connection.
 *
 * @example
 * ```typescript
 * import { HealthController } from './controllers/health.controller';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const controller = new HealthController(prisma);
 *
 * // Use in an Express router
 * router.get('/health', controller.check);
 * ```
 */
export class HealthController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * GET /health
   * Service healthcheck
   *
   * @param _req - Express Request (not used)
   * @param res - Express Response
   */
  check = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Verify database connection
      await this.prisma.$queryRaw`SELECT 1`;

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
