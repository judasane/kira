import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FXService } from '../../services/fx.service';

describe('FXService', () => {
  let fxService: FXService;

  beforeEach(() => {
    fxService = new FXService();
  });

  describe('getRate', () => {
    it('should return FX rate with proper structure', async () => {
      const result = await fxService.getRate('USD', 'MXN');

      expect(result).toHaveProperty('fromCurrency', 'USD');
      expect(result).toHaveProperty('toCurrency', 'MXN');
      expect(result).toHaveProperty('rate');
      expect(result).toHaveProperty('timestamp');
      expect(result.rate).toBeGreaterThan(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return rate within a reasonable range', async () => {
      const result = await fxService.getRate('USD', 'MXN');

      // Should be a reasonable exchange rate for USD to MXN
      expect(result.rate).toBeGreaterThan(10);
      expect(result.rate).toBeLessThan(30);
    });

    it('should return different rates on multiple calls due to jitter', async () => {
      const rates = await Promise.all([
        fxService.getRate('USD', 'MXN'),
        fxService.getRate('USD', 'MXN'),
        fxService.getRate('USD', 'MXN'),
        fxService.getRate('USD', 'MXN'),
        fxService.getRate('USD', 'MXN'),
      ]);

      const uniqueRates = new Set(rates.map(r => r.rate));
      // Es muy probable que al menos algunas tasas sean diferentes
      expect(uniqueRates.size).toBeGreaterThan(1);
    });

    it('should round rate to 4 decimal places', async () => {
      const result = await fxService.getRate('USD', 'MXN');

      const decimalPlaces = result.rate.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it('should use default currencies when not specified', async () => {
      const result = await fxService.getRate();

      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('MXN');
    });
  });

  describe('applyMarkup', () => {
    it('should apply markup correctly', () => {
      const baseRate = 17.0;
      const markup = 0.015; // 1.5%

      const result = fxService.applyMarkup(baseRate, markup);

      expect(result).toBe(17.2550); // 17.0 * 1.015 = 17.255
    });

    it('should round result to 4 decimal places', () => {
      const baseRate = 17.123456789;
      const markup = 0.015;

      const result = fxService.applyMarkup(baseRate, markup);

      const decimalPlaces = result.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });

    it('should handle zero markup', () => {
      const baseRate = 17.0;
      const markup = 0;

      const result = fxService.applyMarkup(baseRate, markup);

      expect(result).toBe(17.0);
    });

    it('should handle negative markup (discount)', () => {
      const baseRate = 17.0;
      const markup = -0.01; // -1% discount

      const result = fxService.applyMarkup(baseRate, markup);

      expect(result).toBe(16.8300); // 17.0 * 0.99
    });
  });
});
