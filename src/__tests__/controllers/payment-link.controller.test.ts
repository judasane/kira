import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock @prisma/client
vi.mock('@prisma/client', () => ({
  PaymentLinkStatus: {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    COMPLETED: 'COMPLETED',
  },
  PrismaClient: vi.fn(),
}));

import { PaymentLinkController } from '../../controllers/payment-link.controller';
import { PaymentLinkStatus } from '@prisma/client';

describe('PaymentLinkController', () => {
  let controller: PaymentLinkController;
  let mockPrisma: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockPrisma = {
      merchant: {
        findUnique: vi.fn(),
      },
      paymentLink: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      transaction: {
        count: vi.fn(),
      },
    };

    controller = new PaymentLinkController(mockPrisma);

    mockReq = {
      body: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockNext = vi.fn();
  });

  describe('createPaymentLink', () => {
    it('should create payment link successfully', async () => {
      const mockMerchant = {
        id: 'merchant_123',
        name: 'Test Merchant',
      };

      const mockPaymentLink = {
        id: 'pl_123',
        merchantId: 'merchant_123',
        amountUsd: 100,
        description: 'Test payment',
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      mockPrisma.paymentLink.create.mockResolvedValue(mockPaymentLink);

      mockReq.body = {
        merchantId: 'merchant_123',
        amountUsd: 100,
        description: 'Test payment',
      };

      await controller.createPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockPrisma.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: 'merchant_123' },
      });

      expect(mockPrisma.paymentLink.create).toHaveBeenCalledWith({
        data: {
          merchantId: 'merchant_123',
          amountUsd: 100,
          description: 'Test payment',
          status: PaymentLinkStatus.ACTIVE,
          expiresAt: null,
          feeConfigOverride: undefined,
        },
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pl_123',
          merchantId: 'merchant_123',
          amountUsd: 100,
          checkoutUrl: expect.stringContaining('/checkout/pl_123'),
        })
      );
    });

    it('should return error if merchant not found', async () => {
      mockPrisma.merchant.findUnique.mockResolvedValue(null);

      mockReq.body = {
        merchantId: 'invalid_merchant',
        amountUsd: 100,
      };

      await controller.createPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NotFoundError',
          message: expect.stringContaining('not found'),
        })
      );
    });

    it('should handle expiresAt date', async () => {
      const mockMerchant = { id: 'merchant_123' };
      const expiresAt = '2024-12-31T23:59:59Z';

      mockPrisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      mockPrisma.paymentLink.create.mockResolvedValue({
        id: 'pl_123',
        merchantId: 'merchant_123',
        amountUsd: 100,
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: new Date(expiresAt),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockReq.body = {
        merchantId: 'merchant_123',
        amountUsd: 100,
        expiresAt,
      };

      await controller.createPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockPrisma.paymentLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: new Date(expiresAt),
          }),
        })
      );
    });

    it('should handle feeConfigOverride', async () => {
      const mockMerchant = { id: 'merchant_123' };
      const feeConfig = {
        fixedFeeUsd: 0.5,
        variableFeePercent: 0.03,
        fxMarkupPercent: 0.02,
        firstTxFreeCount: 0,
      };

      mockPrisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      mockPrisma.paymentLink.create.mockResolvedValue({
        id: 'pl_123',
        merchantId: 'merchant_123',
        amountUsd: 100,
        status: PaymentLinkStatus.ACTIVE,
        feeConfigOverride: feeConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockReq.body = {
        merchantId: 'merchant_123',
        amountUsd: 100,
        feeConfigOverride: feeConfig,
      };

      await controller.createPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockPrisma.paymentLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            feeConfigOverride: feeConfig,
          }),
        })
      );
    });
  });

  describe('getPaymentLink', () => {
    it('should return payment link without fee preview', async () => {
      const mockPaymentLink = {
        id: 'pl_123',
        merchantId: 'merchant_123',
        amountUsd: 100,
        description: 'Test',
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: {
          feeConfigs: [],
        },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);

      mockReq.params = { id: 'pl_123' };
      mockReq.query = { withFeePreview: 'false' };

      await controller.getPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pl_123',
          merchantId: 'merchant_123',
          amountUsd: 100,
        })
      );

      const responseData = (mockRes.json as any).mock.calls[0][0];
      expect(responseData.feePreview).toBeUndefined();
    });

    it('should return error if payment link not found', async () => {
      mockPrisma.paymentLink.findUnique.mockResolvedValue(null);

      mockReq.params = { id: 'invalid_id' };

      await controller.getPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'NotFoundError',
        })
      );
    });

    it('should mark as expired if past expiresAt date', async () => {
      const pastDate = new Date('2020-01-01');
      const mockPaymentLink = {
        id: 'pl_123',
        merchantId: 'merchant_123',
        amountUsd: 100,
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: {
          feeConfigs: [],
        },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockPrisma.paymentLink.update.mockResolvedValue({
        ...mockPaymentLink,
        status: PaymentLinkStatus.EXPIRED,
      });

      mockReq.params = { id: 'pl_123' };
      mockReq.query = { withFeePreview: 'false' };

      await controller.getPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockPrisma.paymentLink.update).toHaveBeenCalledWith({
        where: { id: 'pl_123' },
        data: { status: PaymentLinkStatus.EXPIRED },
      });

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentLinkStatus.EXPIRED,
        })
      );
    });

    it('should include fee preview when requested', async () => {
      const mockPaymentLink = {
        id: 'pl_123',
        merchantId: 'merchant_123',
        amountUsd: 100,
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: null,
        feeConfigOverride: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: {
          feeConfigs: [
            {
              fixedFeeUsd: 0.30,
              variableFeePercent: 0.029,
              fxMarkupPercent: 0.015,
              firstTxFreeCount: 1,
              isDefault: true,
            },
          ],
        },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockPrisma.transaction.count.mockResolvedValue(0);

      mockReq.params = { id: 'pl_123' };
      mockReq.query = {}; // Default is true

      await controller.getPaymentLink(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      const responseData = (mockRes.json as any).mock.calls[0][0];
      expect(responseData.feePreview).toBeDefined();
      expect(responseData.feePreview).toHaveProperty('fxRate');
      expect(responseData.feePreview).toHaveProperty('totalFeesUsd');
      expect(responseData.feePreview).toHaveProperty('recipientAmountMxn');
    });
  });
});
