import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Controlador para healthcheck del servicio.
 * Verifica el estado del servicio y la conexión a la base de datos.
 *
 * @example
 * ```typescript
 * import { HealthController } from './controllers/health.controller';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const controller = new HealthController(prisma);
 *
 * // Usar en un router de Express
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
   * Healthcheck del servicio
   *
   * @param _req - Request de Express (no utilizado)
   * @param res - Response de Express
   */
  check = async (_req: Request, res: Response): Promise<void> => {
    try {
      // Verificar conexión a la base de datos
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
