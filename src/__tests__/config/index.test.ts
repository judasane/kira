import { describe, it, expect } from 'vitest';
import { config } from '../../config/index';

describe('Config', () => {
  describe('Configuration Object', () => {
    it('should have port configuration', () => {
      expect(config.port).toBeDefined();
      expect(typeof config.port).toBe('number');
    });

    it('should have nodeEnv configuration', () => {
      expect(config.nodeEnv).toBeDefined();
      expect(typeof config.nodeEnv).toBe('string');
    });

    it('should have databaseUrl configuration', () => {
      expect(config.databaseUrl).toBeDefined();
      expect(typeof config.databaseUrl).toBe('string');
    });

    it('should have corsOrigin configuration', () => {
      expect(config.corsOrigin).toBeDefined();
      expect(typeof config.corsOrigin).toBe('string');
    });

    it('should have baseUrl configuration', () => {
      expect(config.baseUrl).toBeDefined();
      expect(typeof config.baseUrl).toBe('string');
    });

    it('should have checkoutBaseUrl configuration', () => {
      expect(config.checkoutBaseUrl).toBeDefined();
      expect(typeof config.checkoutBaseUrl).toBe('string');
    });
  });

  describe('FX Configuration', () => {
    it('should have FX baseRate', () => {
      expect(config.fx.baseRate).toBeDefined();
      expect(typeof config.fx.baseRate).toBe('number');
      expect(config.fx.baseRate).toBeGreaterThan(0);
    });

    it('should have FX jitterPercent', () => {
      expect(config.fx.jitterPercent).toBeDefined();
      expect(typeof config.fx.jitterPercent).toBe('number');
      expect(config.fx.jitterPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PSP Configuration', () => {
    it('should have Stripe success rate', () => {
      expect(config.psp.stripe.successRate).toBeDefined();
      expect(typeof config.psp.stripe.successRate).toBe('number');
      expect(config.psp.stripe.successRate).toBeGreaterThan(0);
      expect(config.psp.stripe.successRate).toBeLessThanOrEqual(1);
    });

    it('should have Adyen success rate', () => {
      expect(config.psp.adyen.successRate).toBeDefined();
      expect(typeof config.psp.adyen.successRate).toBe('number');
      expect(config.psp.adyen.successRate).toBeGreaterThan(0);
      expect(config.psp.adyen.successRate).toBeLessThanOrEqual(1);
    });

    it('should have latency configuration', () => {
      expect(config.psp.latency.min).toBeDefined();
      expect(config.psp.latency.max).toBeDefined();
      expect(typeof config.psp.latency.min).toBe('number');
      expect(typeof config.psp.latency.max).toBe('number');
      expect(config.psp.latency.max).toBeGreaterThanOrEqual(config.psp.latency.min);
    });
  });

  describe('Circuit Breaker Configuration', () => {
    it('should have failure threshold', () => {
      expect(config.circuitBreaker.failureThreshold).toBeDefined();
      expect(typeof config.circuitBreaker.failureThreshold).toBe('number');
      expect(config.circuitBreaker.failureThreshold).toBeGreaterThan(0);
    });

    it('should have timeout', () => {
      expect(config.circuitBreaker.timeoutMs).toBeDefined();
      expect(typeof config.circuitBreaker.timeoutMs).toBe('number');
      expect(config.circuitBreaker.timeoutMs).toBeGreaterThan(0);
    });
  });
});
