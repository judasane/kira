import { FeeConfig } from '@prisma/client';
import { FeeConfiguration } from '../types';

/**
 * Helper: Obtiene la configuración de fees (override o default)
 */
export function getFeeConfig(paymentLink: {
  feeConfigOverride?: unknown | null;
  merchant: { feeConfigs: FeeConfig[] };
}): FeeConfiguration {
  if (paymentLink.feeConfigOverride) {
    return paymentLink.feeConfigOverride as FeeConfiguration;
  }

  const defaultConfig = paymentLink.merchant.feeConfigs[0];
  if (!defaultConfig) {
    // Fallback a valores por defecto
    return {
      fixedFeeUsd: 0.30,
      variableFeePercent: 0.029,
      fxMarkupPercent: 0.015,
      firstTxFreeCount: 0,
    };
  }

  return {
    fixedFeeUsd: defaultConfig.fixedFeeUsd.toNumber(),
    variableFeePercent: defaultConfig.variableFeePercent.toNumber(),
    fxMarkupPercent: defaultConfig.fxMarkupPercent.toNumber(),
    firstTxFreeCount: defaultConfig.firstTxFreeCount,
  };
}
