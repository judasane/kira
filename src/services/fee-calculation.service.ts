import { FeeConfiguration, FeeBreakdown, FeeCalculationResult } from '../types';
import { fxService } from './fx.service';

/**
 * Fee calculation engine.
 * Centralizes all commission logic in the system.
 *
 * @example
 * ```typescript
 * import { feeCalculationService } from './services/fee-calculation.service';
 *
 * // Calculate fees for a transaction
 * const feeConfig = {
 *   fixedFeeUsd: 0.30,
 *   variableFeePercent: 0.029, // 2.9%
 *   fxMarkupPercent: 0.02,     // 2%
 *   firstTxFreeCount: 1
 * };
 *
 * const result = await feeCalculationService.calculate(
 *   100.00,      // $100 USD
 *   feeConfig,
 *   true,        // first transaction
 *   20.5         // FX rate (optional)
 * );
 *
 * console.log('Total to charge (USD):', result.totalChargeUsd);
 * console.log('Recipient will receive (MXN):', result.recipientAmountMxn);
 * console.log('Total fees:', result.fees.totalFeesUsd);
 * console.log('Breakdown:', result.fees);
 * ```
 */
export class FeeCalculationService {
  /**
   * Calculates the total fees and complete breakdown for a transaction.
   *
   * @param amountUsd - Base amount in USD
   * @param feeConfig - Merchant fee configuration
   * @param isFirstTransaction - Whether this is the first transaction (to apply incentive)
   * @param fxRate - Current FX rate (if not provided, obtained in real-time)
   * @returns Complete calculation result with fee breakdown and amounts
   */
  async calculate(
    amountUsd: number,
    feeConfig: FeeConfiguration,
    isFirstTransaction: boolean = false,
    fxRate?: number
  ): Promise<FeeCalculationResult> {
    // 1. Get FX rate if not provided
    if (!fxRate) {
      const fxRateData = await fxService.getRate('USD', 'MXN');
      fxRate = fxRateData.rate;
    }

    // 2. Calculate fees in order

    // 2a. Fixed fee
    const fixedFeeUsd = feeConfig.fixedFeeUsd;

    // 2b. Variable fee (on base amount)
    const variableFeeUsd = amountUsd * feeConfig.variableFeePercent;

    // 2c. FX markup fee (on converted base amount)
    const amountMxnBase = amountUsd * fxRate;
    const fxMarkupUsd = amountUsd * feeConfig.fxMarkupPercent;

    // 2d. Total fees before incentives
    const totalFeesBeforeDiscount = fixedFeeUsd + variableFeeUsd + fxMarkupUsd;

    // 2e. Apply first transaction incentive if applicable
    let firstTxDiscountUsd = 0;
    if (isFirstTransaction && feeConfig.firstTxFreeCount > 0) {
      // If it's the first transaction and there's an incentive, fees are 0
      firstTxDiscountUsd = totalFeesBeforeDiscount;
    }

    // 3. Final fees
    const totalFeesUsd = Math.max(0, totalFeesBeforeDiscount - firstTxDiscountUsd);

    // 4. Apply markup to the FX rate
    const fxRateWithMarkup = fxService.applyMarkup(fxRate, feeConfig.fxMarkupPercent);

    // 5. Total amount to charge in USD (base + fees)
    const totalChargeUsd = amountUsd + totalFeesUsd;

    // 6. Amount the recipient will receive in MXN
    // We use the rate with markup for the final calculation
    const recipientAmountMxn = amountUsd * fxRateWithMarkup;

    // 7. Build result
    const breakdown: FeeBreakdown = {
      fixedFeeUsd: this.roundToTwoDecimals(fixedFeeUsd),
      variableFeeUsd: this.roundToTwoDecimals(variableFeeUsd),
      fxMarkupUsd: this.roundToTwoDecimals(fxMarkupUsd),
      firstTxDiscountUsd: this.roundToTwoDecimals(firstTxDiscountUsd),
      totalFeesUsd: this.roundToTwoDecimals(totalFeesUsd),
    };

    return {
      amountUsd: this.roundToTwoDecimals(amountUsd),
      fxRate: this.roundToFourDecimals(fxRate),
      fxRateWithMarkup: this.roundToFourDecimals(fxRateWithMarkup),
      amountMxn: this.roundToTwoDecimals(amountMxnBase),
      fees: breakdown,
      totalChargeUsd: this.roundToTwoDecimals(totalChargeUsd),
      recipientAmountMxn: this.roundToTwoDecimals(recipientAmountMxn),
    };
  }

  /**
   * Calculates fee preview without modifying state
   *
   * @param amountUsd - Base amount in USD
   * @param feeConfig - Merchant fee configuration
   * @param isFirstTransaction - Whether this is the first transaction (to apply incentive)
   * @returns Calculation result same as calculate()
   */
  async preview(
    amountUsd: number,
    feeConfig: FeeConfiguration,
    isFirstTransaction: boolean = false
  ): Promise<FeeCalculationResult> {
    return this.calculate(amountUsd, feeConfig, isFirstTransaction);
  }

  /**
   * Rounds to 2 decimals (for USD/MXN amounts)
   *
   * @param value - Value to round
   * @returns Value rounded to 2 decimals
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Rounds to 4 decimals (for FX rates)
   *
   * @param value - Value to round
   * @returns Value rounded to 4 decimals
   */
  private roundToFourDecimals(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}

// Singleton
export const feeCalculationService = new FeeCalculationService();
