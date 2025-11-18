import { describe, it, expect, beforeEach } from 'vitest';
import { FXService } from './fx.service';
import { config } from '../config';

describe('FXService', () => {
  let fxService: FXService;

  beforeEach(() => {
    fxService = new FXService();
  });

  describe('getRate', () => {
    it('should return a rate within the expected jitter range', async () => {
      const result = await fxService.getRate('USD', 'MXN');
      const baseRate = config.fx.baseRate;
      const jitterPercent = config.fx.jitterPercent;

      const lowerBound = baseRate * (1 - jitterPercent / 100);
      const upperBound = baseRate * (1 + jitterPercent / 100);

      expect(result.rate).toBeGreaterThanOrEqual(lowerBound);
      expect(result.rate).toBeLessThanOrEqual(upperBound);
    });

    it('should return the correct currency pair', async () => {
      const result = await fxService.getRate('USD', 'MXN');
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('MXN');
    });

    it('should return a valid timestamp', async () => {
      const result = await fxService.getRate('USD', 'MXN');
      expect(result.timestamp).toBeInstanceOf(Date);
      // Check if the timestamp is recent (e.g., within the last 5 seconds)
      const timeDifference = new Date().getTime() - result.timestamp.getTime();
      expect(timeDifference).toBeLessThan(5000);
    });
  });

  describe('applyMarkup', () => {
    it('should correctly apply the markup percentage to the rate', () => {
      const rate = 20.0;
      const markupPercent = 1.0; // 1%
      const result = fxService.applyMarkup(rate, markupPercent / 100);
      expect(result).toBe(20.2); // 20 * (1 + 0.01)
    });

    it('should round the result to 4 decimal places', () => {
      const rate = 20.12345;
      const markupPercent = 1.23; // 1.23%
      const result = fxService.applyMarkup(rate, markupPercent / 100);
      // 20.12345 * (1 + 0.0123) = 20.370968435 -> rounded to 20.3710
      expect(result).toBe(20.3710);
    });

    it('should handle a zero markup', () => {
      const rate = 20.0;
      const markupPercent = 0;
      const result = fxService.applyMarkup(rate, markupPercent);
      expect(result).toBe(rate);
    });

    it('should handle a zero rate', () => {
      const rate = 0;
      const markupPercent = 1.0; // 1%
      const result = fxService.applyMarkup(rate, markupPercent / 100);
      expect(result).toBe(0);
    });
  });
});
