import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentLinkStatus } from '@prisma/client';
import { CreatePaymentLinkDTO } from '../validators/payment-link.validator';
import { feeCalculationService } from '../services/fee-calculation.service';
import { FeeConfiguration } from '../types';
import { config } from '../config';

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
    req: Request<{}, {}, CreatePaymentLinkDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { merchantId, amountUsd, description, expiresAt, feeConfigOverride } = req.body;

      // Validar que el merchant existe
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
      });

      if (!merchant) {
        const error = new Error(`Merchant ${merchantId} not found`);
        error.name = 'NotFoundError';
        throw error;
      }

      // Crear el payment link
      const paymentLink = await this.prisma.paymentLink.create({
        data: {
          merchantId,
          amountUsd,
          description: description || null,
          status: PaymentLinkStatus.ACTIVE,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          feeConfigOverride: feeConfigOverride || null,
        },
      });

      // Construir URL del checkout
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
   * Obtener un payment link con preview de fees
   */
  getPaymentLink = async (
    req: Request<{ id: string }, {}, {}, { withFeePreview?: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const withFeePreview = req.query.withFeePreview !== 'false';

      // Obtener el payment link
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

      // Validar que no esté expirado
      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        await this.prisma.paymentLink.update({
          where: { id },
          data: { status: PaymentLinkStatus.EXPIRED },
        });
        paymentLink.status = PaymentLinkStatus.EXPIRED;
      }

      // Construir response base
      const checkoutUrl = `${config.checkoutBaseUrl}/checkout/${paymentLink.id}`;
      const response: any = {
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

      // Calcular preview de fees si se solicitó
      if (withFeePreview) {
        // Obtener fee config (override o default del merchant)
        const feeConfig = this.getFeeConfig(paymentLink);

        // Contar transacciones del merchant para incentivo
        const txCount = await this.prisma.transaction.count({
          where: {
            paymentLink: {
              merchantId: paymentLink.merchantId,
            },
            status: 'COMPLETED',
          },
        });

        const isFirstTx = txCount < feeConfig.firstTxFreeCount;

        // Calcular preview
        const calculation = await feeCalculationService.preview(
          paymentLink.amountUsd,
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

  /**
   * Helper: Obtiene la configuración de fees (override o default)
   */
  private getFeeConfig(paymentLink: any): FeeConfiguration {
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
      fixedFeeUsd: defaultConfig.fixedFeeUsd,
      variableFeePercent: defaultConfig.variableFeePercent,
      fxMarkupPercent: defaultConfig.fxMarkupPercent,
      firstTxFreeCount: defaultConfig.firstTxFreeCount,
    };
  }
}
