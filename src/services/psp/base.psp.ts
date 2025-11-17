import { PSPProvider, PSPAttemptStatus } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse, PSPClient } from '../../types';
import { config } from '../../config';

/**
 * Clase base abstracta para PSP mocks.
 * Implementa comportamiento común de simulación de latencia y resultados aleatorios.
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
   * Simula latencia de red del PSP
   */
  protected async simulateLatency(): Promise<number> {
    const { min, max } = config.psp.latency;
    const latency = min + Math.random() * (max - min);
    await new Promise(resolve => setTimeout(resolve, latency));
    return Math.round(latency);
  }

  /**
   * Determina si el cargo será exitoso basado en la tasa de éxito configurada
   */
  protected shouldSucceed(): boolean {
    return Math.random() < this.successRate;
  }

  /**
   * Simula diferentes tipos de fallos
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
   * Genera un ID único para el cargo
   */
  protected generateChargeId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `ch_${this.provider.toLowerCase()}_${timestamp}_${random}`;
  }

  /**
   * Genera un ID único para la transacción
   */
  protected generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `tx_${this.provider.toLowerCase()}_${timestamp}_${random}`;
  }
}
