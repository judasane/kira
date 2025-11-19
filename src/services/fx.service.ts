import { FXRate } from '../types';
import { config } from '../config';

/**
 * Mock FX service that simulates obtaining real-time exchange rates.
 * Applies a configurable jitter to simulate market volatility.
 *
 * @example
 * ```typescript
 * import { fxService } from './services/fx.service';
 *
 * // Get current exchange rate
 * const rate = await fxService.getRate('USD', 'MXN');
 * console.log('Rate USD->MXN:', rate.rate);
 * console.log('Timestamp:', rate.timestamp);
 *
 * // Apply markup to a rate
 * const baseRate = 20.5;
 * const markupPercent = 0.02; // 2%
 * const rateWithMarkup = fxService.applyMarkup(baseRate, markupPercent);
 * console.log('Rate with markup:', rateWithMarkup); // 20.91
 * ```
 */
export class FXService {
  private baseRate: number;
  private jitterPercent: number;

  constructor() {
    this.baseRate = config.fx.baseRate;
    this.jitterPercent = config.fx.jitterPercent;
  }

  /**
   * Gets the current USD -> MXN exchange rate with jitter applied.
   * Each call may return a slightly different value.
   *
   * @param fromCurrency - Source currency (default 'USD')
   * @param toCurrency - Target currency (default 'MXN')
   * @returns FXRate object with the rate, currencies and timestamp
   */
  async getRate(fromCurrency: string = 'USD', toCurrency: string = 'MXN'): Promise<FXRate> {
    // Simulate network latency
    await this.simulateLatency();

    // Apply jitter: ±jitterPercent%
    const jitter = (Math.random() * 2 - 1) * (this.jitterPercent / 100);
    const rateWithJitter = this.baseRate * (1 + jitter);

    // Round to 4 decimals
    const rate = Math.round(rateWithJitter * 10000) / 10000;

    return {
      fromCurrency,
      toCurrency,
      rate,
      timestamp: new Date(),
    };
  }

  /**
   * Simulates network latency (50-150ms)
   *
   * @returns Promise that resolves after the simulated latency
   */
  private async simulateLatency(): Promise<void> {
    const latency = 50 + Math.random() * 100;
    return new Promise(resolve => setTimeout(resolve, latency));
  }

  /**
   * Applies markup to the base rate (for fee calculation)
   *
   * @param rate - Base rate to which the markup will be applied
   * @param markupPercent - Markup percentage to apply (e.g., 0.02 for 2%)
   * @returns Rate with markup applied, rounded to 4 decimals
   */
  applyMarkup(rate: number, markupPercent: number): number {
    return Math.round(rate * (1 + markupPercent) * 10000) / 10000;
  }
}

// Singleton
export const fxService = new FXService();
