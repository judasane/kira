import { FeeConfiguration, FeeConfigFromPrisma } from '../types';

/**
 * Extracts the fee configuration from a payment link
 * Prioritizes the link override, then the merchant's default configuration
 */
export function getFeeConfig(paymentLink: {
  feeConfigOverride?: unknown | null;
  merchant: { feeConfigs: FeeConfigFromPrisma[] };
}): FeeConfiguration {
  // Use override if it exists
  if (paymentLink.feeConfigOverride) {
    return paymentLink.feeConfigOverride as FeeConfiguration;
  }

  // Use merchant's default configuration
  const defaultConfig = paymentLink.merchant.feeConfigs[0];
  if (!defaultConfig) {
    // Fallback to system default values
    return {
      fixedFeeUsd: 0.30,
      variableFeePercent: 0.029,
      fxMarkupPercent: 0.015,
      firstTxFreeCount: 0,
    };
  }

  // Convert Prisma Decimal to number
  return {
    fixedFeeUsd: Number(defaultConfig.fixedFeeUsd),
    variableFeePercent: Number(defaultConfig.variableFeePercent),
    fxMarkupPercent: Number(defaultConfig.fxMarkupPercent),
    firstTxFreeCount: defaultConfig.firstTxFreeCount,
  };
}
