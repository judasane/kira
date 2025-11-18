import { FeeConfiguration, FeeBreakdown, FeeCalculationResult } from '../types';
import { fxService } from './fx.service';

/**
 * Motor de cálculo de fees.
 * Centraliza toda la lógica de comisiones del sistema.
 *
 * @example
 * ```typescript
 * import { feeCalculationService } from './services/fee-calculation.service';
 *
 * // Calcular fees para una transacción
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
 *   true,        // primera transacción
 *   20.5         // tasa FX (opcional)
 * );
 *
 * console.log('Total a cobrar (USD):', result.totalChargeUsd);
 * console.log('Recipient recibirá (MXN):', result.recipientAmountMxn);
 * console.log('Fees totales:', result.fees.totalFeesUsd);
 * console.log('Desglose:', result.fees);
 * ```
 */
export class FeeCalculationService {
  /**
   * Calcula los fees totales y el desglose completo para una transacción.
   *
   * @param amountUsd - Monto base en USD
   * @param feeConfig - Configuración de fees del merchant
   * @param isFirstTransaction - Si es la primera transacción (para aplicar incentivo)
   * @param fxRate - Tasa FX actual (si no se provee, se obtiene en tiempo real)
   * @returns Resultado completo del cálculo con desglose de fees y montos
   */
  async calculate(
    amountUsd: number,
    feeConfig: FeeConfiguration,
    isFirstTransaction: boolean = false,
    fxRate?: number
  ): Promise<FeeCalculationResult> {
    // 1. Obtener tasa FX si no se provee
    if (!fxRate) {
      const fxRateData = await fxService.getRate('USD', 'MXN');
      fxRate = fxRateData.rate;
    }

    // 2. Calcular fees en orden

    // 2a. Fee fija
    const fixedFeeUsd = feeConfig.fixedFeeUsd;

    // 2b. Fee variable (sobre el monto base)
    const variableFeeUsd = amountUsd * feeConfig.variableFeePercent;

    // 2c. Fee de markup FX (sobre el monto base convertido)
    const amountMxnBase = amountUsd * fxRate;
    const fxMarkupUsd = amountUsd * feeConfig.fxMarkupPercent;

    // 2d. Total de fees antes de incentivos
    const totalFeesBeforeDiscount = fixedFeeUsd + variableFeeUsd + fxMarkupUsd;

    // 2e. Aplicar incentivo de primera transacción si aplica
    let firstTxDiscountUsd = 0;
    if (isFirstTransaction && feeConfig.firstTxFreeCount > 0) {
      // Si es primera transacción y hay incentivo, los fees son 0
      firstTxDiscountUsd = totalFeesBeforeDiscount;
    }

    // 3. Fees finales
    const totalFeesUsd = Math.max(0, totalFeesBeforeDiscount - firstTxDiscountUsd);

    // 4. Aplicar markup a la tasa FX
    const fxRateWithMarkup = fxService.applyMarkup(fxRate, feeConfig.fxMarkupPercent);

    // 5. Monto total a cobrar en USD (base + fees)
    const totalChargeUsd = amountUsd + totalFeesUsd;

    // 6. Monto que recibirá el recipient en MXN
    // Usamos la tasa con markup para el cálculo final
    const recipientAmountMxn = amountUsd * fxRateWithMarkup;

    // 7. Construir resultado
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
   * Calcula preview de fees sin modificar estado
   *
   * @param amountUsd - Monto base en USD
   * @param feeConfig - Configuración de fees del merchant
   * @param isFirstTransaction - Si es la primera transacción (para aplicar incentivo)
   * @returns Resultado del cálculo igual que calculate()
   */
  async preview(
    amountUsd: number,
    feeConfig: FeeConfiguration,
    isFirstTransaction: boolean = false
  ): Promise<FeeCalculationResult> {
    return this.calculate(amountUsd, feeConfig, isFirstTransaction);
  }

  /**
   * Redondea a 2 decimales (para montos en USD/MXN)
   *
   * @param value - Valor a redondear
   * @returns Valor redondeado a 2 decimales
   */
  private roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Redondea a 4 decimales (para tasas FX)
   *
   * @param value - Valor a redondear
   * @returns Valor redondeado a 4 decimales
   */
  private roundToFourDecimals(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}

// Singleton
export const feeCalculationService = new FeeCalculationService();
