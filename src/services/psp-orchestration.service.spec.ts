import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PSPOrchestrationService } from './psp-orchestration.service';
import { getPSPClient } from './psp';
import { circuitBreakerManager } from './circuit-breaker';
import { PrismaClient, PSPProvider, PSPAttemptStatus } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse } from '../types';

// Mock dependencies
vi.mock('./psp');
vi.mock('./circuit-breaker');

const mockPrisma = {
  pSPAttempt: {
    create: vi.fn(),
  },
} as unknown as PrismaClient;

const mockStripeClient = {
  charge: vi.fn(),
};

const mockAdyenClient = {
  charge: vi.fn(),
};

const mockBreaker = {
  canExecute: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
};

describe('PSPOrchestrationService', () => {
  let service: PSPOrchestrationService;

  const chargeRequest: PSPChargeRequest = {
    amount: 100,
    currency: 'USD',
    token: 'tok_visa',
  };
  const transactionId = 'txn_123';

  beforeEach(() => {
    service = new PSPOrchestrationService(mockPrisma);
    vi.resetAllMocks();

    // Default mock implementations
    vi.mocked(getPSPClient).mockImplementation(provider => {
      if (provider === PSPProvider.STRIPE) return mockStripeClient;
      if (provider === PSPProvider.ADYEN) return mockAdyenClient;
      throw new Error('Unknown provider');
    });

    vi.mocked(circuitBreakerManager.getBreaker).mockReturnValue(mockBreaker);
  });

  it('should succeed with the primary provider', async () => {
    const successResponse: PSPChargeResponse = {
      success: true,
      status: PSPAttemptStatus.SUCCESS,
      chargeId: 'ch_stripe_123',
      latencyMs: 150,
    };
    mockStripeClient.charge.mockResolvedValue(successResponse);

    const result = await service.executeCharge(
      PSPProvider.STRIPE,
      chargeRequest,
      transactionId
    );

    expect(result.success).toBe(true);
    expect(result.finalProvider).toBe(PSPProvider.STRIPE);
    expect(result.attempts.length).toBe(1);
    expect(result.attempts[0].provider).toBe(PSPProvider.STRIPE);
    expect(mockStripeClient.charge).toHaveBeenCalledTimes(1);
    expect(mockAdyenClient.charge).not.toHaveBeenCalled();
    expect(mockBreaker.recordSuccess).toHaveBeenCalledTimes(1);
  });

  it('should failover to the secondary provider if the primary fails', async () => {
    const errorResponse: PSPChargeResponse = {
      success: false,
      status: PSPAttemptStatus.ERROR,
      errorMessage: 'Technical error',
      latencyMs: 500,
    };
    const successResponse: PSPChargeResponse = {
      success: true,
      status: PSPAttemptStatus.SUCCESS,
      chargeId: 'ch_adyen_456',
      latencyMs: 200,
    };
    mockStripeClient.charge.mockResolvedValue(errorResponse);
    mockAdyenClient.charge.mockResolvedValue(successResponse);

    const result = await service.executeCharge(
      PSPProvider.STRIPE,
      chargeRequest,
      transactionId
    );

    expect(result.success).toBe(true);
    expect(result.finalProvider).toBe(PSPProvider.ADYEN);
    expect(result.attempts.length).toBe(2);
    expect(mockStripeClient.charge).toHaveBeenCalledTimes(1);
    expect(mockAdyenClient.charge).toHaveBeenCalledTimes(1);
    expect(mockBreaker.recordFailure).toHaveBeenCalledTimes(1);
    expect(mockBreaker.recordSuccess).toHaveBeenCalledTimes(1);
  });

  it('should not failover if the primary declines the charge', async () => {
    const declinedResponse: PSPChargeResponse = {
      success: false,
      status: PSPAttemptStatus.DECLINED,
      errorMessage: 'Insufficient funds',
      latencyMs: 180,
    };
    mockStripeClient.charge.mockResolvedValue(declinedResponse);

    const result = await service.executeCharge(
      PSPProvider.STRIPE,
      chargeRequest,
      transactionId
    );

    expect(result.success).toBe(false);
    expect(result.attempts.length).toBe(1);
    expect(result.finalResponse?.status).toBe(PSPAttemptStatus.DECLINED);
    expect(mockStripeClient.charge).toHaveBeenCalledTimes(1);
    expect(mockAdyenClient.charge).not.toHaveBeenCalled();
    // Declined is not a technical failure, so recordFailure should not be called
    expect(mockBreaker.recordFailure).not.toHaveBeenCalled();
  });

  it('should fail if both primary and secondary providers fail', async () => {
    const errorResponse: PSPChargeResponse = {
      success: false,
      status: PSPAttemptStatus.ERROR,
      errorMessage: 'Technical error',
      latencyMs: 500,
    };
    mockStripeClient.charge.mockResolvedValue(errorResponse);
    mockAdyenClient.charge.mockResolvedValue(errorResponse);

    const result = await service.executeCharge(
      PSPProvider.STRIPE,
      chargeRequest,
      transactionId
    );

    expect(result.success).toBe(false);
    expect(result.finalProvider).toBeNull();
    expect(result.attempts.length).toBe(2);
    expect(mockBreaker.recordFailure).toHaveBeenCalledTimes(2);
  });

  it('should skip the primary provider if its circuit breaker is open', async () => {
    // Simulate breaker is open for the first call, closed for the second
    vi.mocked(mockBreaker.canExecute).mockReturnValueOnce(false);
    const successResponse: PSPChargeResponse = {
      success: true,
      status: PSPAttemptStatus.SUCCESS,
      chargeId: 'ch_adyen_789',
      latencyMs: 220,
    };
    mockAdyenClient.charge.mockResolvedValue(successResponse);

    const result = await service.executeCharge(
      PSPProvider.STRIPE,
      chargeRequest,
      transactionId
    );

    expect(result.success).toBe(true);
    expect(result.finalProvider).toBe(PSPProvider.ADYEN);
    expect(result.attempts.length).toBe(2);
    // Stripe charge should not have been called
    expect(mockStripeClient.charge).not.toHaveBeenCalled();
    // Adyen charge should have been called
    expect(mockAdyenClient.charge).toHaveBeenCalledTimes(1);
  });

  it('should persist all attempts correctly', async () => {
    const attempts = [
      {
        provider: PSPProvider.STRIPE,
        isPrimary: true,
        response: {
          success: false,
          status: PSPAttemptStatus.ERROR,
          latencyMs: 100,
        },
      },
      {
        provider: PSPProvider.ADYEN,
        isPrimary: false,
        response: {
          success: true,
          status: PSPAttemptStatus.SUCCESS,
          latencyMs: 150,
          chargeId: 'adyen123',
        },
      },
    ];

    await service.persistAttempts(transactionId, attempts as any);

    expect(mockPrisma.pSPAttempt.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.pSPAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: transactionId,
          pspProvider: PSPProvider.STRIPE,
          isPrimary: true,
          status: PSPAttemptStatus.ERROR,
        }),
      })
    );
    expect(mockPrisma.pSPAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionId: transactionId,
          pspProvider: PSPProvider.ADYEN,
          isPrimary: false,
          status: PSPAttemptStatus.SUCCESS,
          pspChargeId: 'adyen123',
        }),
      })
    );
  });
});
