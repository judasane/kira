import { PSPAttemptStatus, PSPProvider } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse } from '../../types';
import { BasePSPMock } from './base.psp';
import { config } from '../../config';

/**
 * Mock de Adyen PSP.
 * Simula la API de Adyen para crear pagos.
 */
export class AdyenMock extends BasePSPMock {
  constructor() {
    super(PSPProvider.ADYEN, config.psp.adyen.successRate);
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    const startTime = Date.now();

    // Simular latencia de red
    const latencyMs = await this.simulateLatency();

    // Validar token
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
