import { PSPProvider } from '@prisma/client';
import { CircuitBreakerState, CircuitBreakerConfig } from '../types';
import { config } from '../config';

/**
 * Circuit Breaker simple para PSPs.
 * Previene llamadas repetidas a PSPs que están fallando.
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
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  /**
   * Registra un fallo
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
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Resetea el circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Gestor global de circuit breakers para cada PSP
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
