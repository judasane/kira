import { PSPProvider, PSPAttemptStatus, PrismaClient } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse } from '../types';
import { getPSPClient } from './psp';
import { circuitBreakerManager } from './circuit-breaker';

/**
 * Orchestration result with all attempts
 */
export interface OrchestrationResult {
  success: boolean;
  finalProvider: PSPProvider | null;
  finalResponse: PSPChargeResponse | null;
  attempts: Array<{
    provider: PSPProvider;
    isPrimary: boolean;
    response: PSPChargeResponse;
  }>;
}

/**
 * PSP orchestration service with automatic failover.
 * Manages primary/secondary routing logic and circuit breakers.
 *
 * @example
 * ```typescript
 * import { PSPOrchestrationService } from './services/psp-orchestration.service';
 * import { PrismaClient, PSPProvider } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const orchestration = new PSPOrchestrationService(prisma);
 *
 * // Execute charge with automatic failover
 * const result = await orchestration.executeCharge(
 *   PSPProvider.STRIPE,
 *   {
 *     amount: 10000,
 *     currency: 'usd',
 *     token: 'tok_visa',
 *     idempotencyKey: 'key_123',
 *     metadata: {}
 *   },
 *   'transaction_id_123'
 * );
 *
 * if (result.success) {
 *   console.log('Successful charge with:', result.finalProvider);
 *   console.log('Attempts made:', result.attempts.length);
 * }
 *
 * // Persist attempts to DB
 * await orchestration.persistAttempts('transaction_id_123', result.attempts);
 * ```
 */
export class PSPOrchestrationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Executes the charge against PSPs with failover logic.
   *
   * @param primaryProvider - Primary PSP to try first
   * @param request - Charge request
   * @param transactionId - Transaction ID (for logging)
   * @returns Orchestration result with all attempts and the final provider
   */
  async executeCharge(
    primaryProvider: PSPProvider,
    request: PSPChargeRequest,
    transactionId: string
  ): Promise<OrchestrationResult> {
    const attempts: OrchestrationResult['attempts'] = [];

    // Determine secondary PSP
    const secondaryProvider = this.getSecondaryProvider(primaryProvider);

    // 1. Try with primary PSP
    const primaryResult = await this.attemptCharge(
      primaryProvider,
      request,
      transactionId,
      true
    );
    attempts.push({
      provider: primaryProvider,
      isPrimary: true,
      response: primaryResult,
    });

    // If primary succeeded, return immediately
    if (primaryResult.success) {
      return {
        success: true,
        finalProvider: primaryProvider,
        finalResponse: primaryResult,
        attempts,
      };
    }

    // If primary failed with explicit DECLINED, DO NOT failover
    // (decline is a business decision by the PSP, not a technical error)
    if (primaryResult.status === PSPAttemptStatus.DECLINED) {
      return {
        success: false,
        finalProvider: primaryProvider,
        finalResponse: primaryResult,
        attempts,
      };
    }

    // 2. Primary failed due to technical error (TIMEOUT/ERROR)
    // Attempt failover to secondary PSP
    console.log(
      `[Orchestration] Primary ${primaryProvider} failed with ${primaryResult.status}, attempting failover to ${secondaryProvider}`
    );

    const secondaryResult = await this.attemptCharge(
      secondaryProvider,
      request,
      transactionId,
      false
    );
    attempts.push({
      provider: secondaryProvider,
      isPrimary: false,
      response: secondaryResult,
    });

    // Return secondary result
    return {
      success: secondaryResult.success,
      finalProvider: secondaryResult.success ? secondaryProvider : null,
      finalResponse: secondaryResult,
      attempts,
    };
  }

  /**
   * Attempts to execute a charge against a specific PSP.
   * Respects the PSP circuit breaker.
   *
   * @param provider - PSP to use
   * @param request - Charge request
   * @param _transactionId - Transaction ID (for logging)
   * @param _isPrimary - Whether this is the primary attempt
   * @returns PSP response
   */
  private async attemptCharge(
    provider: PSPProvider,
    request: PSPChargeRequest,
    _transactionId: string,
    _isPrimary: boolean
  ): Promise<PSPChargeResponse> {
    // Check circuit breaker
    const breaker = circuitBreakerManager.getBreaker(provider);

    if (!breaker.canExecute()) {
      console.log(`[Orchestration] Circuit breaker OPEN for ${provider}, skipping attempt`);
      return {
        success: false,
        status: PSPAttemptStatus.ERROR,
        statusCode: 503,
        errorMessage: `Circuit breaker is OPEN for ${provider}`,
        latencyMs: 0,
        rawResponse: { error: 'Circuit breaker open' },
      };
    }

    // Get PSP client
    const pspClient = getPSPClient(provider);

    try {
      // Execute charge
      const response = await pspClient.charge(request);

      // Record result in circuit breaker
      if (response.success) {
        breaker.recordSuccess();
      } else if (
        response.status === PSPAttemptStatus.ERROR ||
        response.status === PSPAttemptStatus.TIMEOUT
      ) {
        breaker.recordFailure();
      }
      // NOTE: DECLINED does not count as infrastructure failure

      return response;
    } catch (error) {
      // Unexpected error
      console.error(`[Orchestration] Unexpected error calling ${provider}:`, error);
      breaker.recordFailure();

      return {
        success: false,
        status: PSPAttemptStatus.ERROR,
        statusCode: 500,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: 0,
        rawResponse: { error: String(error) },
      };
    }
  }

  /**
   * Determines the secondary PSP for failover
   *
   * @param primary - Primary PSP
   * @returns Secondary PSP (alternates between STRIPE and ADYEN)
   */
  private getSecondaryProvider(primary: PSPProvider): PSPProvider {
    return primary === PSPProvider.STRIPE ? PSPProvider.ADYEN : PSPProvider.STRIPE;
  }

  /**
   * Persists PSP attempts to the database
   *
   * @param transactionId - Transaction ID
   * @param attempts - Array of attempts made
   */
  async persistAttempts(
    transactionId: string,
    attempts: OrchestrationResult['attempts']
  ): Promise<void> {
    for (const attempt of attempts) {
      await this.prisma.pSPAttempt.create({
        data: {
          transactionId,
          pspProvider: attempt.provider,
          isPrimary: attempt.isPrimary,
          status: attempt.response.status,
          statusCode: attempt.response.statusCode || 0,
          errorMessage: attempt.response.errorMessage,
          latencyMs: attempt.response.latencyMs,
          pspChargeId: attempt.response.chargeId,
          pspTransactionId: attempt.response.transactionId,
          requestPayload: {
            amount: 0, // Can be added from the original request
          },
          responsePayload: attempt.response.rawResponse || {},
        },
      });
    }
  }
}
