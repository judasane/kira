import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeeCalculationService } from './fee-calculation.service';
import { fxService } from './fx.service';
import { FeeConfiguration } from '../types';

// Mock the fxService dependency
vi.mock('./fx.service', () => ({
  fxService: {
    getRate: vi.fn(),
    applyMarkup: vi.fn(),
  },
}));

describe('FeeCalculationService', () => {
  let feeCalculationService: FeeCalculationService;
  const mockFxRate = 20.0;
  const mockFeeConfig: FeeConfiguration = {
    fixedFeeUsd: 1.0,
    variableFeePercent: 0.02, // 2%
    fxMarkupPercent: 0.01, // 1%
    firstTxFreeCount: 1,
  };

  beforeEach(() => {
    feeCalculationService = new FeeCalculationService();
    // Reset mocks before each test
    vi.resetAllMocks();

    // Default mock implementations
    vi.mocked(fxService.getRate).mockResolvedValue({ rate: mockFxRate });
    vi.mocked(fxService.applyMarkup).mockImplementation(
      (rate, markup) => rate * (1 + markup)
    );
  });

  it('should calculate fees correctly for a standard transaction', async () => {
    const amountUsd = 100;

    const result = await feeCalculationService.calculate(
      amountUsd,
      mockFeeConfig,
      false
    );

    // 1. Fixed fee
    const expectedFixedFee = 1.0;
    // 2. Variable fee (2% of 100)
    const expectedVariableFee = 100 * 0.02; // 2.0
    // 3. FX Markup fee (1% of 100)
    const expectedFxMarkup = 100 * 0.01; // 1.0
    // 4. Total fees
    const expectedTotalFees = expectedFixedFee + expectedVariableFee + expectedFxMarkup; // 4.0

    expect(result.fees.fixedFeeUsd).toBe(expectedFixedFee);
    expect(result.fees.variableFeeUsd).toBe(expectedVariableFee);
    expect(result.fees.fxMarkupUsd).toBe(expectedFxMarkup);
    expect(result.fees.totalFeesUsd).toBe(expectedTotalFees);
    expect(result.totalChargeUsd).toBe(amountUsd + expectedTotalFees);
    expect(result.recipientAmountMxn).toBe(100 * (mockFxRate * (1 + 0.01)));

    // Verify that fxService.getRate was called since no rate was provided
    expect(fxService.getRate).toHaveBeenCalledWith('USD', 'MXN');
  });

  it('should apply the first transaction discount correctly', async () => {
    const amountUsd = 100;

    const result = await feeCalculationService.calculate(
      amountUsd,
      mockFeeConfig,
      true // isFirstTransaction = true
    );

    const totalFeesBeforeDiscount = 1.0 + 100 * 0.02 + 100 * 0.01; // 4.0

    expect(result.fees.firstTxDiscountUsd).toBe(totalFeesBeforeDiscount);
    expect(result.fees.totalFeesUsd).toBe(0);
    expect(result.totalChargeUsd).toBe(amountUsd); // Total charge is just the base amount
  });

  it('should use the provided fxRate instead of fetching it', async () => {
    const amountUsd = 100;
    const providedFxRate = 21.5;

    await feeCalculationService.calculate(
      amountUsd,
      mockFeeConfig,
      false,
      providedFxRate // Provide the rate directly
    );

    // Verify that fxService.getRate was NOT called
    expect(fxService.getRate).not.toHaveBeenCalled();
    // Verify that the provided rate was used for markup calculation
    expect(fxService.applyMarkup).toHaveBeenCalledWith(
      providedFxRate,
      mockFeeConfig.fxMarkupPercent
    );
  });

  it('preview method should call calculate method', async () => {
    const amountUsd = 150;
    const calculateSpy = vi.spyOn(feeCalculationService, 'calculate');

    await feeCalculationService.preview(amountUsd, mockFeeConfig, false);

    expect(calculateSpy).toHaveBeenCalledWith(amountUsd, mockFeeConfig, false);
  });
});
