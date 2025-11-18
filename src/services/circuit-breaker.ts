import { PSPProvider } from '@prisma/client';
import { CircuitBreakerState, CircuitBreakerConfig } from '../types';
import { config } from '../config';

/**
 * Circuit Breaker simple para PSPs.
 * Previene llamadas repetidas a PSPs que están fallando.
 *
 * @example
 * ```typescript
 * import { CircuitBreaker } from './services/circuit-breaker';
 * import { PSPProvider } from '@prisma/client';
 *
 * const breaker = new CircuitBreaker(PSPProvider.STRIPE);
 *
 * // Verificar si se puede ejecutar
 * if (breaker.canExecute()) {
 *   try {
 *     // Ejecutar operación
 *     const result = await pspClient.charge(request);
 *     breaker.recordSuccess();
 *   } catch (error) {
 *     breaker.recordFailure();
 *   }
 * } else {
 *   console.log('Circuit breaker está OPEN, no se puede ejecutar');
 * }
 *
 * // Verificar estado
 * console.log('Estado actual:', breaker.getState());
 * ```
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(_provider: PSPProvider, circuitConfig?: CircuitBreakerConfig) {
    this.config = circuitConfig || {
      failureThreshold: config.circuitBreaker.failureThreshold,
      timeout: config.circuitBreaker.timeoutMs,
    };
  }

  /**
   * Verifica si se puede ejecutar una llamada al PSP
   *
   * @returns true si se puede ejecutar, false si el circuit breaker está OPEN
   */
  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      // Verificar si ha pasado suficiente tiempo para intentar de nuevo
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN: permitir un intento para probar
    return true;
  }

  /**
   * Registra un éxito
   * Resetea el contador de fallos y cierra el circuit breaker
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  /**
   * Registra un fallo
   * Incrementa el contador de fallos y abre el circuit breaker si se alcanza el threshold
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Falló en estado HALF_OPEN, volver a OPEN
      this.state = CircuitBreakerState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  /**
   * Obtiene el estado actual
   *
   * @returns Estado actual del circuit breaker (CLOSED, OPEN, o HALF_OPEN)
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Resetea el circuit breaker
   * Vuelve el estado a CLOSED y limpia contadores
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Gestor global de circuit breakers para cada PSP
 *
 * @example
 * ```typescript
 * import { circuitBreakerManager } from './services/circuit-breaker';
 * import { PSPProvider } from '@prisma/client';
 *
 * // Obtener circuit breaker para un PSP específico
 * const stripeBreaker = circuitBreakerManager.getBreaker(PSPProvider.STRIPE);
 *
 * if (stripeBreaker.canExecute()) {
 *   // Ejecutar operación...
 * }
 *
 * // Resetear todos los circuit breakers
 * circuitBreakerManager.resetAll();
 * ```
 */
class CircuitBreakerManager {
  private breakers: Map<PSPProvider, CircuitBreaker> = new Map();

  getBreaker(provider: PSPProvider): CircuitBreaker {
    if (!this.breakers.has(provider)) {
      this.breakers.set(provider, new CircuitBreaker(provider));
    }
    return this.breakers.get(provider)!;
  }

  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();
