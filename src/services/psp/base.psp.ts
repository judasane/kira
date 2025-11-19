import { PSPProvider, PSPAttemptStatus } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse, PSPClient } from '../../types';
import { config } from '../../config';

/**
 * Abstract base class for PSP mocks.
 * Implements common behavior for latency simulation and random results.
 *
 * @example
 * ```typescript
 * class MyPSPMock extends BasePSPMock {
 *   constructor() {
 *     super(PSPProvider.STRIPE, 0.95);
 *   }
 *
 *   async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
 *     const latencyMs = await this.simulateLatency();
 *     const willSucceed = this.shouldSucceed();
 *
 *     if (willSucceed) {
 *       return {
 *         success: true,
 *         chargeId: this.generateChargeId(),
 *         transactionId: this.generateTransactionId(),
 *         status: PSPAttemptStatus.SUCCESS,
 *         statusCode: 200,
 *         latencyMs,
 *         rawResponse: {}
 *       };
 *     }
 *
 *     const failure = this.simulateFailure();
 *     return { success: false, ...failure, latencyMs, rawResponse: {} };
 *   }
 * }
 *
 * const psp = new MyPSPMock();
 * const result = await psp.charge({ amount: 1000, currency: 'usd', token: 'tok_123', idempotencyKey: 'key_123', metadata: {} });
 * ```
 */
export abstract class BasePSPMock implements PSPClient {
  protected successRate: number;
  protected provider: PSPProvider;

  constructor(provider: PSPProvider, successRate: number) {
    this.provider = provider;
    this.successRate = successRate;
  }

  abstract charge(request: PSPChargeRequest): Promise<PSPChargeResponse>;

  getProvider(): PSPProvider {
    return this.provider;
  }

  /**
   * Simulates PSP network latency
   *
   * @returns Simulated latency in milliseconds
   */
  protected async simulateLatency(): Promise<number> {
    const { min, max } = config.psp.latency;
    const latency = min + Math.random() * (max - min);
    await new Promise(resolve => setTimeout(resolve, latency));
    return Math.round(latency);
  }

  /**
   * Determines if the charge will be successful based on the configured success rate
   *
   * @returns true if the charge should succeed, false otherwise
   */
  protected shouldSucceed(): boolean {
    return Math.random() < this.successRate;
  }

  /**
   * Simulates different types of failures
   *
   * @returns Object with failure details (status, statusCode, errorMessage)
   */
  protected simulateFailure(): { status: PSPAttemptStatus; statusCode: number; errorMessage: string } {
    const failureTypes = [
      {
        status: PSPAttemptStatus.DECLINED,
        statusCode: 402,
        errorMessage: 'Card was declined',
      },
      {
        status: PSPAttemptStatus.DECLINED,
        statusCode: 402,
        errorMessage: 'Insufficient funds',
      },
      {
        status: PSPAttemptStatus.ERROR,
        statusCode: 500,
        errorMessage: 'Internal server error',
      },
      {
        status: PSPAttemptStatus.TIMEOUT,
        statusCode: 504,
        errorMessage: 'Gateway timeout',
      },
    ];

    return failureTypes[Math.floor(Math.random() * failureTypes.length)];
  }

  /**
   * Generates a unique ID for the charge
   *
   * @returns Unique charge ID with format ch_{provider}_{timestamp}_{random}
   */
  protected generateChargeId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `ch_${this.provider.toLowerCase()}_${timestamp}_${random}`;
  }

  /**
   * Generates a unique ID for the transaction
   *
   * @returns Unique transaction ID with format tx_{provider}_{timestamp}_{random}
   */
  protected generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `tx_${this.provider.toLowerCase()}_${timestamp}_${random}`;
  }
}
