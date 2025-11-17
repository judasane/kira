import { PSPProvider, PSPAttemptStatus, PrismaClient } from '@prisma/client';
import { PSPChargeRequest, PSPChargeResponse } from '../types';
import { getPSPClient } from './psp';
import { circuitBreakerManager } from './circuit-breaker';

/**
 * Resultado de orquestación con todos los intentos
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
 * Servicio de orquestación de PSPs con failover automático.
 * Gestiona la lógica de routing primario/secundario y circuit breakers.
 */
export class PSPOrchestrationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Ejecuta el cargo contra PSPs con lógica de failover.
   *
   * @param primaryProvider - PSP primario a intentar primero
   * @param request - Request del cargo
   * @param transactionId - ID de la transacción (para logging)
   */
  async executeCharge(
    primaryProvider: PSPProvider,
    request: PSPChargeRequest,
    transactionId: string
  ): Promise<OrchestrationResult> {
    const attempts: OrchestrationResult['attempts'] = [];

    // Determinar PSP secundario
    const secondaryProvider = this.getSecondaryProvider(primaryProvider);

    // 1. Intentar con PSP primario
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

    // Si el primario tuvo éxito, retornar inmediatamente
    if (primaryResult.success) {
      return {
        success: true,
        finalProvider: primaryProvider,
        finalResponse: primaryResult,
        attempts,
      };
    }

    // Si el primario falló con DECLINED explícito, NO hacer failover
    // (decline es una decisión de negocio del PSP, no un error técnico)
    if (primaryResult.status === PSPAttemptStatus.DECLINED) {
      return {
        success: false,
        finalProvider: primaryProvider,
        finalResponse: primaryResult,
        attempts,
      };
    }

    // 2. El primario falló por error técnico (TIMEOUT/ERROR)
    // Intentar failover al PSP secundario
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

    // Retornar resultado del secundario
    return {
      success: secondaryResult.success,
      finalProvider: secondaryResult.success ? secondaryProvider : null,
      finalResponse: secondaryResult,
      attempts,
    };
  }

  /**
   * Intenta ejecutar un cargo contra un PSP específico.
   * Respeta el circuit breaker del PSP.
   */
  private async attemptCharge(
    provider: PSPProvider,
    request: PSPChargeRequest,
    _transactionId: string,
    _isPrimary: boolean
  ): Promise<PSPChargeResponse> {
    // Verificar circuit breaker
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

    // Obtener cliente PSP
    const pspClient = getPSPClient(provider);

    try {
      // Ejecutar cargo
      const response = await pspClient.charge(request);

      // Registrar resultado en circuit breaker
      if (response.success) {
        breaker.recordSuccess();
      } else if (
        response.status === PSPAttemptStatus.ERROR ||
        response.status === PSPAttemptStatus.TIMEOUT
      ) {
        breaker.recordFailure();
      }
      // NOTE: DECLINED no cuenta como fallo de infraestructura

      return response;
    } catch (error) {
      // Error inesperado
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
   * Determina el PSP secundario para failover
   */
  private getSecondaryProvider(primary: PSPProvider): PSPProvider {
    return primary === PSPProvider.STRIPE ? PSPProvider.ADYEN : PSPProvider.STRIPE;
  }

  /**
   * Persiste los intentos de PSP en la base de datos
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
            amount: 0, // Se puede agregar del request original
          },
          responsePayload: attempt.response.rawResponse || {},
        },
      });
    }
  }
}
