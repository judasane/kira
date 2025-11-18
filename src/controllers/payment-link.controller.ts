import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentLinkStatus } from '@prisma/client';
import { CreatePaymentLinkDTO } from '../validators/payment-link.validator';
import { feeCalculationService } from '../services/fee-calculation.service';
import { config } from '../config';
import { getFeeConfig } from '../utils/fee-config.utils';

export class PaymentLinkController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * POST /payment-links
   * Crear un nuevo payment link
   */
  createPaymentLink = async (
    req: Request<object, object, CreatePaymentLinkDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { merchantId, amountUsd, description, expiresAt, feeConfigOverride } = req.body;

      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
      });

      if (!merchant) {
        const error = new Error(`Merchant ${merchantId} not found`);
        error.name = 'NotFoundError';
        throw error;
      }

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

      const checkoutUrl = `${config.checkoutBaseUrl}/checkout/${paymentLink.id}`;

      res.status(201).json({
        id: paymentLink.id,
        merchantId: paymentLink.merchantId,
        status: paymentLink.status,
        amountUsd: Number(paymentLink.amountUsd),
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
   * Obtener un payment link con preview de fees
   */
  getPaymentLink = async (
    req: Request<{ id: string }, object, object, { withFeePreview?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const withFeePreview = req.query.withFeePreview !== 'false';

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

      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        await this.prisma.paymentLink.update({
          where: { id },
          data: { status: PaymentLinkStatus.EXPIRED },
        });
        paymentLink.status = PaymentLinkStatus.EXPIRED;
      }

      const checkoutUrl = `${config.checkoutBaseUrl}/checkout/${paymentLink.id}`;
      const response: Record<string, unknown> = {
        id: paymentLink.id,
        merchantId: paymentLink.merchantId,
        status: paymentLink.status,
        amountUsd: Number(paymentLink.amountUsd),
        description: paymentLink.description,
        expiresAt: paymentLink.expiresAt,
        createdAt: paymentLink.createdAt,
        updatedAt: paymentLink.updatedAt,
        checkoutUrl,
      };

      if (withFeePreview) {
        const feeConfig = getFeeConfig(paymentLink);

        const txCount = await this.prisma.transaction.count({
          where: {
            paymentLink: {
              merchantId: paymentLink.merchantId,
            },
            status: 'COMPLETED',
          },
        });

        const isFirstTx = txCount < feeConfig.firstTxFreeCount;

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
