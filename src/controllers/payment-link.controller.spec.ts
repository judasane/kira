import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentLinkController } from './payment-link.controller';
import { PrismaClient, PaymentLinkStatus, FeeConfig } from '@prisma/client';
import { Request, Response } from 'express';
import { feeCalculationService } from '../services/fee-calculation.service';
import { Decimal } from '@prisma/client/runtime/library';

// Mock PrismaClient
const prisma = {
  paymentLink: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    count: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock feeCalculationService
vi.mock('../services/fee-calculation.service', () => ({
  feeCalculationService: {
    preview: vi.fn(),
  },
}));

describe('PaymentLinkController', () => {
  let controller: PaymentLinkController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    controller = new PaymentLinkController(prisma);
    req = {
      params: { id: 'test-link-id' },
      query: { withFeePreview: 'true' },
    };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('getPaymentLink', () => {
    it('should return a payment link with a fee preview', async () => {
      const mockPaymentLink = {
        id: 'test-link-id',
        merchantId: 'test-merchant-id',
        amountUsd: new Decimal(100),
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: null,
        merchant: {
          feeConfigs: [
            {
              fixedFeeUsd: new Decimal(0.3),
              variableFeePercent: new Decimal(0.029),
              fxMarkupPercent: new Decimal(0.015),
              firstTxFreeCount: 1,
            } as FeeConfig,
          ],
        },
      };

      const mockCalculation = {
        fxRate: 20.5,
        fees: {
          totalFeesUsd: 4.7,
          fixedFeeUsd: 0.3,
          variableFeeUsd: 2.9,
          fxMarkupUsd: 1.5,
          firstTxDiscountUsd: 0,
        },
        recipientAmountMxn: 2050,
      };

      vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue(mockPaymentLink as any);
      vi.mocked(prisma.transaction.count).mockResolvedValue(0);
      vi.mocked(feeCalculationService.preview).mockResolvedValue(mockCalculation as any);

      await controller.getPaymentLink(req as Request, res as Response, next);

      expect(prisma.paymentLink.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-link-id' },
        include: expect.any(Object),
      });
      expect(prisma.transaction.count).toHaveBeenCalled();
      expect(feeCalculationService.preview).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-link-id',
          amountUsd: 100,
          feePreview: expect.any(Object),
        })
      );
    });
  });
});
