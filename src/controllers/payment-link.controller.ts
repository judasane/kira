import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentLinkStatus } from '@prisma/client';
import { CreatePaymentLinkDTO } from '../validators/payment-link.validator';
import { feeCalculationService } from '../services/fee-calculation.service';
import { config } from '../config';
import { getFeeConfig } from '../utils/fee-config.utils';

/**
 * Controller for payment link management.
 * Handles creation and query of payment links.
 *
 * @example
 * ```typescript
 * import { PaymentLinkController } from './controllers/payment-link.controller';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const controller = new PaymentLinkController(prisma);
 *
 * // Use in an Express router
 * router.post('/payment-links', controller.createPaymentLink);
 * router.get('/payment-links/:id', controller.getPaymentLink);
 * ```
 */
export class PaymentLinkController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * POST /payment-links
   * Create a new payment link
   *
   * @param req - Express Request with CreatePaymentLinkDTO in the body
   * @param res - Express Response
   * @param next - NextFunction for error handling
   */
  createPaymentLink = async (
    req: Request<object, object, CreatePaymentLinkDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { merchantId, amountUsd, description, expiresAt, feeConfigOverride } = req.body;

      // Validate that the merchant exists
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
      });

      if (!merchant) {
        const error = new Error(`Merchant ${merchantId} not found`);
        error.name = 'NotFoundError';
        throw error;
      }

      // Create the payment link
      const paymentLink = await this.prisma.paymentLink.create({
        data: {
          merchantId,
          amountUsd,
          description: description || null,
          status: PaymentLinkStatus.ACTIVE,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          feeConfigOverride: feeConfigOverride || undefined,
        },
      });

      // Build checkout URL
      const checkoutUrl = `${config.checkoutBaseUrl}/checkout/${paymentLink.id}`;

      res.status(201).json({
        id: paymentLink.id,
        merchantId: paymentLink.merchantId,
        status: paymentLink.status,
        amountUsd: paymentLink.amountUsd,
        description: paymentLink.description,
        expiresAt: paymentLink.expiresAt,
        createdAt: paymentLink.createdAt,
        updatedAt: paymentLink.updatedAt,
        checkoutUrl,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /payment-links/:id
   * Get a payment link with fee preview
   *
   * @param req - Express Request with id in params and withFeePreview in query
   * @param res - Express Response
   * @param next - NextFunction for error handling
   */
  getPaymentLink = async (
    req: Request<{ id: string }, object, object, { withFeePreview?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const withFeePreview = req.query.withFeePreview !== 'false';

      // Get the payment link
      const paymentLink = await this.prisma.paymentLink.findUnique({
        where: { id },
        include: {
          merchant: {
            include: {
              feeConfigs: {
                where: { isDefault: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!paymentLink) {
        const error = new Error(`Payment link ${id} not found`);
        error.name = 'NotFoundError';
        throw error;
      }

      // Validate that it is not expired
      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        await this.prisma.paymentLink.update({
          where: { id },
          data: { status: PaymentLinkStatus.EXPIRED },
        });
        paymentLink.status = PaymentLinkStatus.EXPIRED;
      }

      // Build base response
      const checkoutUrl = `${config.checkoutBaseUrl}/checkout/${paymentLink.id}`;
      const response: Record<string, unknown> = {
        id: paymentLink.id,
        merchantId: paymentLink.merchantId,
        status: paymentLink.status,
        amountUsd: paymentLink.amountUsd,
        description: paymentLink.description,
        expiresAt: paymentLink.expiresAt,
        createdAt: paymentLink.createdAt,
        updatedAt: paymentLink.updatedAt,
        checkoutUrl,
      };

      // Calculate fee preview if requested
      if (withFeePreview) {
        // Get fee config (override or merchant default)
        const feeConfig = getFeeConfig(paymentLink);

        // Count merchant transactions for incentive
        const txCount = await this.prisma.transaction.count({
          where: {
            paymentLink: {
              merchantId: paymentLink.merchantId,
            },
            status: 'COMPLETED',
          },
        });

        const isFirstTx = txCount < feeConfig.firstTxFreeCount;

        // Calculate preview
        const calculation = await feeCalculationService.preview(
          Number(paymentLink.amountUsd),
          feeConfig,
          isFirstTx
        );

        response.feePreview = {
          fxRate: calculation.fxRate,
          totalFeesUsd: calculation.fees.totalFeesUsd,
          recipientAmountMxn: calculation.recipientAmountMxn,
          breakdown: {
            fixedFeeUsd: calculation.fees.fixedFeeUsd,
            variableFeeUsd: calculation.fees.variableFeeUsd,
            fxMarkupUsd: calculation.fees.fxMarkupUsd,
            firstTxDiscountUsd: calculation.fees.firstTxDiscountUsd,
          },
        };
      }

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}
