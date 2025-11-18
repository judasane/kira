import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentController } from './payment.controller';
import { PrismaClient, PaymentLinkStatus, TransactionStatus, FeeConfig, PSPProvider } from '@prisma/client';
import { Request, Response } from 'express';
import { feeCalculationService } from '../services/fee-calculation.service';
import { PSPOrchestrationService } from '../services/psp-orchestration.service';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies
vi.mock('../services/fee-calculation.service');

// Mock PrismaClient
const prisma = {
  paymentLink: { findUnique: vi.fn() },
  transaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient;

describe('PaymentController', () => {
  let controller: PaymentController;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;
  let mockOrchestrationService: PSPOrchestrationService;

  beforeEach(() => {
    // Create a mock instance of the service
    mockOrchestrationService = {
      executeCharge: vi.fn(),
      persistAttempts: vi.fn(),
    } as unknown as PSPOrchestrationService;

    // Pass the mock service to the controller
    controller = new PaymentController(prisma, mockOrchestrationService);

    req = {
      params: { id: 'test-link-id' },
      body: {
        cardToken: 'tok_visa',
        idempotencyKey: 'test-idem-key',
        pspProvider: PSPProvider.STRIPE,
      },
    };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
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
              firstTxFreeCount: 0,
            } as FeeConfig,
          ],
        },
      };

      const mockCalculation = {
        totalChargeUsd: 104.7,
        recipientAmountMxn: 2050,
        fxRateWithMarkup: 21.0,
        fees: { totalFeesUsd: 4.7 },
      };

      const mockTransaction = { id: 'test-tx-id', status: TransactionStatus.PENDING };
      const mockOrchestrationResult = { success: true, finalProvider: 'STRIPE', attempts: [] };

      // Setup mocks
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.paymentLink.findUnique).mockResolvedValue(mockPaymentLink as any);
      vi.mocked(prisma.transaction.count).mockResolvedValue(1);
      vi.mocked(feeCalculationService.calculate).mockResolvedValue(mockCalculation as any);
      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as any);
      vi.mocked(mockOrchestrationService.executeCharge).mockResolvedValue(mockOrchestrationResult as any);

      const finalTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        amountUsd: new Decimal(104.7),
        amountMxn: new Decimal(2050),
        fxRateApplied: new Decimal(21.0),
        feesTotalUsd: new Decimal(4.7),
      };
      vi.mocked(prisma.transaction.update).mockResolvedValue(finalTransaction as any);

      await controller.processPayment(req as Request, res as Response, next);

      expect(mockOrchestrationService.executeCharge).toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          amountUsd: 104.7,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
