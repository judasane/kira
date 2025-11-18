import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeeCalculationService } from '../../services/fee-calculation.service';
import { fxService } from '../../services/fx.service';
import { FeeConfiguration } from '../../types';

// Mock del FX service
vi.mock('../../services/fx.service', () => ({
  fxService: {
    getRate: vi.fn(),
    applyMarkup: vi.fn((rate, markup) => rate * (1 + markup)),
  },
}));

describe('FeeCalculationService', () => {
  let service: FeeCalculationService;
  const mockFeeConfig: FeeConfiguration = {
    fixedFeeUsd: 0.30,
    variableFeePercent: 0.029, // 2.9%
    fxMarkupPercent: 0.015, // 1.5%
    firstTxFreeCount: 1,
  };

  beforeEach(() => {
    service = new FeeCalculationService();
    vi.clearAllMocks();

    // Setup default FX mock
    vi.mocked(fxService.getRate).mockResolvedValue({
      fromCurrency: 'USD',
      toCurrency: 'MXN',
      rate: 17.0,
      timestamp: new Date(),
    });
  });

  describe('calculate', () => {
    it('should calculate fees correctly for a basic transaction', async () => {
      const amountUsd = 100;
      const fxRate = 17.0;

      const result = await service.calculate(amountUsd, mockFeeConfig, false, fxRate);

      // Expected calculations:
      // Fixed: 0.30
      // Variable: 100 * 0.029 = 2.90
      // FX Markup: 100 * 0.015 = 1.50
      // Total fees: 0.30 + 2.90 + 1.50 = 4.70
      // Total charge: 100 + 4.70 = 104.70
      // Recipient amount: 100 * 17.0 * 1.015 = 1,725.50

      expect(result.amountUsd).toBe(100);
      expect(result.fxRate).toBe(17.0);
      expect(result.fees.fixedFeeUsd).toBe(0.30);
      expect(result.fees.variableFeeUsd).toBe(2.90);
      expect(result.fees.fxMarkupUsd).toBe(1.50);
      expect(result.fees.totalFeesUsd).toBe(4.70);
      expect(result.totalChargeUsd).toBe(104.70);
      expect(result.recipientAmountMxn).toBe(1725.50);
    });

    it('should apply first transaction discount', async () => {
      const amountUsd = 100;
      const fxRate = 17.0;

      const result = await service.calculate(amountUsd, mockFeeConfig, true, fxRate);

      // First transaction should have 0 fees
      expect(result.fees.firstTxDiscountUsd).toBe(4.70); // Total of all fees
      expect(result.fees.totalFeesUsd).toBe(0);
      expect(result.totalChargeUsd).toBe(100); // Only base amount
    });

    it('should not apply discount if firstTxFreeCount is 0', async () => {
      const amountUsd = 100;
      const fxRate = 17.0;
      const configWithoutDiscount: FeeConfiguration = {
        ...mockFeeConfig,
        firstTxFreeCount: 0,
      };

      const result = await service.calculate(amountUsd, configWithoutDiscount, true, fxRate);

      expect(result.fees.firstTxDiscountUsd).toBe(0);
      expect(result.fees.totalFeesUsd).toBe(4.70);
    });

    it('should fetch FX rate if not provided', async () => {
      const amountUsd = 100;

      await service.calculate(amountUsd, mockFeeConfig, false);

      expect(fxService.getRate).toHaveBeenCalledWith('USD', 'MXN');
    });

    it('should not fetch FX rate if provided', async () => {
      const amountUsd = 100;
      const fxRate = 17.5;

      await service.calculate(amountUsd, mockFeeConfig, false, fxRate);

      expect(fxService.getRate).not.toHaveBeenCalled();
    });

    it('should round all monetary values to 2 decimals', async () => {
      const amountUsd = 33.333;
      const fxRate = 17.123;

      const result = await service.calculate(amountUsd, mockFeeConfig, false, fxRate);

      // Check all USD values have max 2 decimals
      expect(result.amountUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      expect(result.fees.fixedFeeUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      expect(result.fees.variableFeeUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      expect(result.fees.fxMarkupUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      expect(result.totalChargeUsd.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      expect(result.recipientAmountMxn.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });

    it('should round FX rates to 4 decimals', async () => {
      const amountUsd = 100;
      const fxRate = 17.123456789;

      const result = await service.calculate(amountUsd, mockFeeConfig, false, fxRate);

      expect(result.fxRate.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
      expect(result.fxRateWithMarkup.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
    });

    it('should handle small amounts correctly', async () => {
      const amountUsd = 1;
      const fxRate = 17.0;

      const result = await service.calculate(amountUsd, mockFeeConfig, false, fxRate);

      // Fixed: 0.30
      // Variable: 1 * 0.029 = 0.029 -> 0.03
      // FX Markup: 1 * 0.015 = 0.015 -> 0.02
      // Total fees: 0.30 + 0.03 + 0.02 = 0.35

      expect(result.fees.totalFeesUsd).toBeGreaterThan(0);
      expect(result.totalChargeUsd).toBeGreaterThan(amountUsd);
    });

    it('should never return negative fees', async () => {
      const amountUsd = 0.01; // Very small amount
      const fxRate = 17.0;

      const result = await service.calculate(amountUsd, mockFeeConfig, false, fxRate);

      expect(result.fees.totalFeesUsd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('preview', () => {
    it('should return calculation results', async () => {
      const amountUsd = 100;

      const result = await service.preview(amountUsd, mockFeeConfig, false);

      // Preview should return calculation results
      expect(result).toHaveProperty('amountUsd');
      expect(result).toHaveProperty('fees');
      expect(result).toHaveProperty('totalChargeUsd');
      expect(result.amountUsd).toBe(100);
    });

    it('should return same result as calculate', async () => {
      const amountUsd = 100;

      const previewResult = await service.preview(amountUsd, mockFeeConfig, false);
      const calculateResult = await service.calculate(amountUsd, mockFeeConfig, false);

      // Should be similar (might differ slightly due to FX jitter in real scenario)
      expect(previewResult.amountUsd).toBe(calculateResult.amountUsd);
      expect(previewResult.fees.fixedFeeUsd).toBe(calculateResult.fees.fixedFeeUsd);
    });
  });
});
