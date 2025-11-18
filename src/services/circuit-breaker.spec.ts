import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  circuitBreakerManager,
} from './circuit-breaker';
import { CircuitBreakerState } from '../types';
import { PSPProvider } from '@prisma/client';

const testConfig = {
  failureThreshold: 2,
  timeout: 5000, // 5 seconds
};

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    // Use fake timers to control timeouts
    vi.useFakeTimers();
    breaker = new CircuitBreaker(PSPProvider.STRIPE, testConfig);
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  it('should start in a CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.canExecute()).toBe(true);
  });

  it('should move to OPEN state after reaching the failure threshold', () => {
    breaker.recordFailure();
    breaker.recordFailure(); // Reaches threshold of 2

    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    expect(breaker.canExecute()).toBe(false);
  });

  it('should stay in CLOSED state if failures do not reach the threshold', () => {
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('should move to HALF_OPEN after the timeout', () => {
    breaker.recordFailure();
    breaker.recordFailure(); // Now OPEN

    expect(breaker.canExecute()).toBe(false);

    // Advance time by the timeout period
    vi.advanceTimersByTime(testConfig.timeout);

    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('should move back to CLOSED from HALF_OPEN after a success', () => {
    breaker.recordFailure();
    breaker.recordFailure(); // OPEN
    vi.advanceTimersByTime(testConfig.timeout); // HALF_OPEN

    expect(breaker.canExecute()).toBe(true);
    breaker.recordSuccess();

    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('should move back to OPEN from HALF_OPEN after a failure', () => {
    breaker.recordFailure();
    breaker.recordFailure(); // OPEN
    vi.advanceTimersByTime(testConfig.timeout); // HALF_OPEN

    expect(breaker.canExecute()).toBe(true);
    breaker.recordFailure();

    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    expect(breaker.canExecute()).toBe(false);
  });

  it('should reset to CLOSED state', () => {
    breaker.recordFailure();
    breaker.recordFailure(); // OPEN
    breaker.reset();

    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker.canExecute()).toBe(true);
  });
});

describe('CircuitBreakerManager', () => {
  beforeEach(() => {
    circuitBreakerManager.resetAll();
  });

  it('should create and retrieve a breaker for a provider', () => {
    const stripeBreaker = circuitBreakerManager.getBreaker(PSPProvider.STRIPE);
    expect(stripeBreaker).toBeInstanceOf(CircuitBreaker);
    const sameBreaker = circuitBreakerManager.getBreaker(PSPProvider.STRIPE);
    expect(stripeBreaker).toBe(sameBreaker);
  });

  it('should create different breakers for different providers', () => {
    const stripeBreaker = circuitBreakerManager.getBreaker(PSPProvider.STRIPE);
    const adyenBreaker = circuitBreakerManager.getBreaker(PSPProvider.ADYEN);
    expect(stripeBreaker).not.toBe(adyenBreaker);
  });
});
