import { z } from 'zod';
import { PSPProvider } from '@prisma/client';

/**
 * Schema to create a payment link
 */
export const createPaymentLinkSchema = z.object({
  merchantId: z.string().min(1, 'merchantId is required'),
  amountUsd: z.number().min(1, 'Amount must be at least $1').max(5000, 'Amount cannot exceed $5000'),
  description: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  feeConfigOverride: z
    .object({
      fixedFeeUsd: z.number().min(0),
      variableFeePercent: z.number().min(0).max(1),
      fxMarkupPercent: z.number().min(0).max(1),
      firstTxFreeCount: z.number().int().min(0),
    })
    .optional(),
});

export type CreatePaymentLinkDTO = z.infer<typeof createPaymentLinkSchema>;

/**
 * Schema to process a payment
 */
export const processPaymentSchema = z.object({
  cardToken: z.string().min(1, 'cardToken is required'),
  pspProvider: z.nativeEnum(PSPProvider, {
    errorMap: () => ({ message: 'Invalid PSP provider' }),
  }),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  metadata: z.record(z.unknown()).optional(),
});

export type ProcessPaymentDTO = z.infer<typeof processPaymentSchema>;

/**
 * Schema for PSP webhook
 */
export const pspWebhookSchema = z.object({
  provider: z.nativeEnum(PSPProvider),
  eventType: z.string().min(1),
  eventId: z.string().min(1),
  data: z.object({
    transactionId: z.string().optional(),
    pspChargeId: z.string().optional(),
    status: z.string().optional(),
  }),
});

export type PSPWebhookDTO = z.infer<typeof pspWebhookSchema>;
