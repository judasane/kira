import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { HealthController } from '../../controllers/health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn(),
    };

    controller = new HealthController(mockPrisma);

    mockReq = {};

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe('check', () => {
    it('should return healthy status when database is connected', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await controller.check(mockReq as Request, mockRes as Response);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'healthy',
        timestamp: expect.any(String),
        database: 'connected',
      });
    });

    it('should return unhealthy status when database is disconnected', async () => {
      const dbError = new Error('Connection refused');
      mockPrisma.$queryRaw.mockRejectedValue(dbError);

      await controller.check(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'unhealthy',
        timestamp: expect.any(String),
        database: 'disconnected',
        error: 'Connection refused',
      });
    });

    it('should handle unknown errors', async () => {
      mockPrisma.$queryRaw.mockRejectedValue('Unknown error');

      await controller.check(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          error: 'Unknown error',
        })
      );
    });

    it('should include ISO timestamp', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await controller.check(mockReq as Request, mockRes as Response);

      const response = (mockRes.json as any).mock.calls[0][0];
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
