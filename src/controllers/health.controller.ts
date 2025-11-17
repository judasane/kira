import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export class HealthController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * GET /health
   * Healthcheck del servicio
   */
  check = async (req: Request, res: Response): Promise<void> => {
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
