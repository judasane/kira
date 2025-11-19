import { PSPProvider, PSPAttemptStatus, Prisma } from '@prisma/client';

// ============================================================================
// Prisma Types
// ============================================================================

export type FeeConfigFromPrisma = Prisma.FeeConfigGetPayload<object>;

// ============================================================================
// FX Service Types
// ============================================================================

export interface FXRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
}

// ============================================================================
// PSP Mock Types
// ============================================================================

export interface PSPChargeRequest {
  amount: number; // In cents (e.g. 10000 = $100.00 USD)
  currency: string;
  token: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface PSPChargeResponse {
  success: boolean;
  chargeId?: string;
  transactionId?: string;
  status: PSPAttemptStatus;
  statusCode: number;
  errorMessage?: string;
  latencyMs: number;
  rawResponse: unknown;
}

export interface PSPClient {
  charge(request: PSPChargeRequest): Promise<PSPChargeResponse>;
  getProvider(): PSPProvider;
}

// ============================================================================
// Fee Calculation Types
// ============================================================================

export interface FeeConfiguration {
  fixedFeeUsd: number;
  variableFeePercent: number;
  fxMarkupPercent: number;
  firstTxFreeCount: number;
}

export interface FeeBreakdown {
  fixedFeeUsd: number;
  variableFeeUsd: number;
  fxMarkupUsd: number;
  firstTxDiscountUsd: number;
  totalFeesUsd: number;
}

export interface FeeCalculationResult {
  amountUsd: number;
  fxRate: number;
  fxRateWithMarkup: number;
  amountMxn: number;
  fees: FeeBreakdown;
  totalChargeUsd: number;
  recipientAmountMxn: number;
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  code: string;
  details?: unknown;
}

export interface Money {
  currency: string;
  amount: number;
}
