import { PSPAttemptStatus, PSPProvider } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse } from '../../types';
import { BasePSPMock } from './base.psp';
import { config } from '../../config';

/**
 * Mock de Stripe PSP.
 * Simula la API de Stripe para crear cargos.
 *
 * @example
 * ```typescript
 * import { stripeMock } from './services/psp/stripe.mock';
 *
 * // Ejecutar un cargo
 * const response = await stripeMock.charge({
 *   amount: 10000, // $100.00 en centavos
 *   currency: 'usd',
 *   token: 'tok_visa',
 *   idempotencyKey: 'unique_key_123',
 *   metadata: { orderId: 'order_123' }
 * });
 *
 * if (response.success) {
 *   console.log('Cargo exitoso:', response.chargeId);
 *   console.log('Transaction ID:', response.transactionId);
 * } else {
 *   console.error('Cargo fallido:', response.errorMessage);
 * }
 * ```
 */
export class StripeMock extends BasePSPMock {
  constructor() {
    super(PSPProvider.STRIPE, config.psp.stripe.successRate);
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    // Simular latencia de red
    const latencyMs = await this.simulateLatency();

    // Validar token
    if (!request.token.startsWith('tok_')) {
      return {
        success: false,
        status: PSPAttemptStatus.ERROR,
        statusCode: 400,
        errorMessage: 'Invalid token format',
        latencyMs,
        rawResponse: {
          error: {
            type: 'invalid_request_error',
            message: 'Invalid token format',
          },
        },
      };
    }

    // Determinar resultado
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
          id: chargeId,
          object: 'charge',
          amount: request.amount,
          currency: request.currency,
          status: 'succeeded',
          source: {
            id: request.token,
            object: 'card',
            brand: 'visa',
            last4: '4242',
          },
          metadata: request.metadata,
          created: Math.floor(Date.now() / 1000),
        },
      };
    } else {
      const failure = this.simulateFailure();

      return {
        success: false,
        status: failure.status,
        statusCode: failure.statusCode,
        errorMessage: failure.errorMessage,
        latencyMs,
        rawResponse: {
          error: {
            type: failure.status === PSPAttemptStatus.DECLINED ? 'card_error' : 'api_error',
            code: failure.status === PSPAttemptStatus.DECLINED ? 'card_declined' : 'processing_error',
            message: failure.errorMessage,
            decline_code: failure.status === PSPAttemptStatus.DECLINED ? 'generic_decline' : undefined,
          },
        },
      };
    }
  }
}

export const stripeMock = new StripeMock();
