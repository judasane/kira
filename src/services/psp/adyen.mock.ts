import { PSPAttemptStatus, PSPProvider } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse } from '../../types';
import { BasePSPMock } from './base.psp';
import { config } from '../../config';

/**
 * Adyen PSP mock.
 * Simulates the Adyen API for creating payments.
 *
 * @example
 * ```typescript
 * import { adyenMock } from './services/psp/adyen.mock';
 *
 * // Execute a payment
 * const response = await adyenMock.charge({
 *   amount: 10000, // $100.00 in cents
 *   currency: 'usd',
 *   token: 'tok_visa',
 *   idempotencyKey: 'unique_key_123',
 *   metadata: { orderId: 'order_123' }
 * });
 *
 * if (response.success) {
 *   console.log('Payment authorized:', response.chargeId);
 *   console.log('PSP Reference:', response.transactionId);
 * } else {
 *   console.error('Payment rejected:', response.errorMessage);
 * }
 * ```
 */
export class AdyenMock extends BasePSPMock {
  constructor() {
    super(PSPProvider.ADYEN, config.psp.adyen.successRate);
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    // Simulate network latency
    const latencyMs = await this.simulateLatency();

    // Validate token
    if (!request.token.startsWith('tok_')) {
      return {
        success: false,
        status: PSPAttemptStatus.ERROR,
        statusCode: 422,
        errorMessage: 'Invalid payment token',
        latencyMs,
        rawResponse: {
          status: 422,
          errorCode: 'validation',
          message: 'Invalid payment token',
          errorType: 'validation',
        },
      };
    }

    // Determine result
    const willSucceed = this.shouldSucceed();

    if (willSucceed) {
      const chargeId = this.generateChargeId();
      const transactionId = this.generateTransactionId();

      return {
        success: true,
        chargeId,
        transactionId,
        status: PSPAttemptStatus.SUCCESS,
        statusCode: 200,
        latencyMs,
        rawResponse: {
          pspReference: chargeId,
          resultCode: 'Authorised',
          amount: {
            currency: request.currency.toUpperCase(),
            value: request.amount,
          },
          merchantReference: request.idempotencyKey,
          paymentMethod: {
            type: 'scheme',
            brand: 'visa',
          },
          additionalData: {
            cardSummary: '4242',
          },
        },
      };
    } else {
      const failure = this.simulateFailure();

      let resultCode = 'Refused';
      if (failure.status === PSPAttemptStatus.TIMEOUT) {
        resultCode = 'Error';
      } else if (failure.status === PSPAttemptStatus.ERROR) {
        resultCode = 'Error';
      }

      return {
        success: false,
        status: failure.status,
        statusCode: failure.statusCode,
        errorMessage: failure.errorMessage,
        latencyMs,
        rawResponse: {
          pspReference: this.generateChargeId(),
          resultCode,
          refusalReason: failure.errorMessage,
          refusalReasonCode: failure.status === PSPAttemptStatus.DECLINED ? '2' : '0',
        },
      };
    }
  }
}

export const adyenMock = new AdyenMock();
