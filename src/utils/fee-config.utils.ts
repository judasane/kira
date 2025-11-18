import { FeeConfiguration, FeeConfigFromPrisma } from '../types';

/**
 * Extrae la configuración de fees desde un payment link
 * Prioriza el override del link, luego la configuración default del merchant
 */
export function getFeeConfig(paymentLink: {
  feeConfigOverride?: unknown | null;
  merchant: { feeConfigs: FeeConfigFromPrisma[] };
}): FeeConfiguration {
  // Usar override si existe
  if (paymentLink.feeConfigOverride) {
    return paymentLink.feeConfigOverride as FeeConfiguration;
  }

  // Usar configuración default del merchant
  const defaultConfig = paymentLink.merchant.feeConfigs[0];
  if (!defaultConfig) {
    // Fallback a valores por defecto del sistema
    return {
      fixedFeeUsd: 0.30,
      variableFeePercent: 0.029,
      fxMarkupPercent: 0.015,
      firstTxFreeCount: 0,
    };
  }

  // Convertir Decimal de Prisma a number
  return {
    fixedFeeUsd: Number(defaultConfig.fixedFeeUsd),
    variableFeePercent: Number(defaultConfig.variableFeePercent),
    fxMarkupPercent: Number(defaultConfig.fxMarkupPercent),
    firstTxFreeCount: defaultConfig.firstTxFreeCount,
  };
}
