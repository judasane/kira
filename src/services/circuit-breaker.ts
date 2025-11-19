import { PSPProvider } from '@prisma/client';
import { CircuitBreakerState, CircuitBreakerConfig } from '../types';
import { config } from '../config';

/**
 * Simple Circuit Breaker for PSPs.
 * Prevents repeated calls to failing PSPs.
 *
 * @example
 * ```typescript
 * import { CircuitBreaker } from './services/circuit-breaker';
 * import { PSPProvider } from '@prisma/client';
 *
 * const breaker = new CircuitBreaker(PSPProvider.STRIPE);
 *
 * // Check if can execute
 * if (breaker.canExecute()) {
 *   try {
 *     // Execute operation
 *     const result = await pspClient.charge(request);
 *     breaker.recordSuccess();
 *   } catch (error) {
 *     breaker.recordFailure();
 *   }
 * } else {
 *   console.log('Circuit breaker is OPEN, cannot execute');
 * }
 *
 * // Check state
 * console.log('Current state:', breaker.getState());
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
   * Checks if a call to the PSP can be executed
   *
   * @returns true if can execute, false if circuit breaker is OPEN
   */
  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      // Check if enough time has passed to try again
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow one attempt to test
    return true;
  }

  /**
   * Records a success
   * Resets the failure counter and closes the circuit breaker
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  /**
   * Records a failure
   * Increments the failure counter and opens the circuit breaker if threshold is reached
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failed in HALF_OPEN state, return to OPEN
      this.state = CircuitBreakerState.OPEN;
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  /**
   * Gets the current state
   *
   * @returns Current circuit breaker state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Resets the circuit breaker
   * Returns state to CLOSED and clears counters
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Global circuit breaker manager for each PSP
 *
 * @example
 * ```typescript
 * import { circuitBreakerManager } from './services/circuit-breaker';
 * import { PSPProvider } from '@prisma/client';
 *
 * // Get circuit breaker for a specific PSP
 * const stripeBreaker = circuitBreakerManager.getBreaker(PSPProvider.STRIPE);
 *
 * if (stripeBreaker.canExecute()) {
 *   // Execute operation...
 * }
 *
 * // Reset all circuit breakers
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
