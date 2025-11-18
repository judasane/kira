import { FXRate } from '../types';
import { config } from '../config';

/**
 * Servicio mock de FX que simula obtener tasas de cambio en tiempo real.
 * Aplica un jitter configurable para simular volatilidad del mercado.
 *
 * @example
 * ```typescript
 * import { fxService } from './services/fx.service';
 *
 * // Obtener tasa de cambio actual
 * const rate = await fxService.getRate('USD', 'MXN');
 * console.log('Tasa USD->MXN:', rate.rate);
 * console.log('Timestamp:', rate.timestamp);
 *
 * // Aplicar markup a una tasa
 * const baseRate = 20.5;
 * const markupPercent = 0.02; // 2%
 * const rateWithMarkup = fxService.applyMarkup(baseRate, markupPercent);
 * console.log('Tasa con markup:', rateWithMarkup); // 20.91
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
   * Obtiene la tasa de cambio actual USD -> MXN con jitter aplicado.
   * Cada llamada puede retornar un valor ligeramente diferente.
   *
   * @param fromCurrency - Moneda origen (por defecto 'USD')
   * @param toCurrency - Moneda destino (por defecto 'MXN')
   * @returns Objeto FXRate con la tasa, monedas y timestamp
   */
  async getRate(fromCurrency: string = 'USD', toCurrency: string = 'MXN'): Promise<FXRate> {
    // Simular latencia de red
    await this.simulateLatency();

    // Aplicar jitter: ±jitterPercent%
    const jitter = (Math.random() * 2 - 1) * (this.jitterPercent / 100);
    const rateWithJitter = this.baseRate * (1 + jitter);

    // Redondear a 4 decimales
    const rate = Math.round(rateWithJitter * 10000) / 10000;

    return {
      fromCurrency,
      toCurrency,
      rate,
      timestamp: new Date(),
    };
  }

  /**
   * Simula latencia de red (50-150ms)
   *
   * @returns Promise que se resuelve después de la latencia simulada
   */
  private async simulateLatency(): Promise<void> {
    const latency = 50 + Math.random() * 100;
    return new Promise(resolve => setTimeout(resolve, latency));
  }

  /**
   * Aplica markup al rate base (para cálculo de fees)
   *
   * @param rate - Tasa base a la que se aplicará el markup
   * @param markupPercent - Porcentaje de markup a aplicar (ej: 0.02 para 2%)
   * @returns Tasa con markup aplicado, redondeada a 4 decimales
   */
  applyMarkup(rate: number, markupPercent: number): number {
    return Math.round(rate * (1 + markupPercent) * 10000) / 10000;
  }
}

// Singleton
export const fxService = new FXService();
