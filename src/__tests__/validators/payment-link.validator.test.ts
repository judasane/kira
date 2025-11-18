import { describe, it, expect, vi } from 'vitest';

// Mock @prisma/client
vi.mock('@prisma/client', () => ({
  PSPProvider: {
    STRIPE: 'STRIPE',
    ADYEN: 'ADYEN',
  },
  PrismaClient: vi.fn(),
}));

import { createPaymentLinkSchema, processPaymentSchema } from '../../validators/payment-link.validator';

describe('Payment Link Validators', () => {
  describe('createPaymentLinkSchema', () => {
    it('should validate correct payment link data', () => {
      const validData = {
        merchantId: 'merchant-123',
        amountUsd: 100.50,
        description: 'Test payment',
      };

      const result = createPaymentLinkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty merchant ID', () => {
      const invalidData = {
        merchantId: '',
        amountUsd: 100,
      };

      const result = createPaymentLinkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject amount below minimum', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        amountUsd: 0.5,
      };

      const result = createPaymentLinkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject amount above maximum', () => {
      const invalidData = {
        merchantId: 'merchant-123',
        amountUsd: 6000,
      };

      const result = createPaymentLinkSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const validData = {
        merchantId: 'merchant-123',
        amountUsd: 100,
        description: 'Test',
        expiresAt: new Date().toISOString(),
        feeConfigOverride: {
          fixedFeeUsd: 0.5,
          variableFeePercent: 0.03,
          fxMarkupPercent: 0.02,
          firstTxFreeCount: 1,
        },
      };

      const result = createPaymentLinkSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('processPaymentSchema', () => {
    it('should validate correct payment processing data', () => {
      const validData = {
        cardToken: 'tok_visa',
        pspProvider: 'STRIPE',
        idempotencyKey: 'idem-12345',
      };

      const result = processPaymentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid PSP provider', () => {
      const invalidData = {
        cardToken: 'tok_visa',
        pspProvider: 'INVALID_PSP',
        idempotencyKey: 'idem-12345',
      };

      const result = processPaymentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept optional metadata', () => {
      const validData = {
        cardToken: 'tok_visa',
        pspProvider: 'ADYEN',
        idempotencyKey: 'idem-12345',
        metadata: { orderId: '12345', customerId: 'cust-789' },
      };

      const result = processPaymentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
