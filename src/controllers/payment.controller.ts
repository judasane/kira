import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentLinkStatus, TransactionStatus, Prisma } from '@prisma/client';
import { ProcessPaymentDTO } from '../validators/payment-link.validator';
import { feeCalculationService } from '../services/fee-calculation.service';
import { PSPOrchestrationService } from '../services/psp-orchestration.service';
import { FeeConfiguration, PSPChargeRequest } from '../types';

export class PaymentController {
  private prisma: PrismaClient;
  private orchestrationService: PSPOrchestrationService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.orchestrationService = new PSPOrchestrationService(prisma);
  }

  /**
   * POST /payment-links/:id/payments
   * Procesar un pago sobre un payment link
   */
  processPayment = async (
    req: Request<{ id: string }, object, ProcessPaymentDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: paymentLinkId } = req.params;
      const { cardToken, pspProvider, idempotencyKey, metadata } = req.body;

      // 1. Validar idempotencia
      const existingTx = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
      });

      if (existingTx) {
        // Ya existe, retornar la transacción existente
        const error = new Error('Payment already processed with this idempotency key');
        error.name = 'ConflictError';
        throw error;
      }

      // 2. Obtener y validar el payment link
      const paymentLink = await this.prisma.paymentLink.findUnique({
        where: { id: paymentLinkId },
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
        const error = new Error(`Payment link ${paymentLinkId} not found`);
        error.name = 'NotFoundError';
        throw error;
      }

      // Validar estado del link
      if (paymentLink.status !== PaymentLinkStatus.ACTIVE) {
        const error = new Error(`Payment link is not active (status: ${paymentLink.status})`);
        error.name = 'BadRequestError';
        throw error;
      }

      // Validar expiración
      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        await this.prisma.paymentLink.update({
          where: { id: paymentLinkId },
          data: { status: PaymentLinkStatus.EXPIRED },
        });
        const error = new Error('Payment link has expired');
        error.name = 'BadRequestError';
        throw error;
      }

      // 3. Obtener fee config y calcular fees
      const feeConfig = this.getFeeConfig(paymentLink);

      // Contar transacciones para incentivo
      const txCount = await this.prisma.transaction.count({
        where: {
          paymentLink: {
            merchantId: paymentLink.merchantId,
          },
          status: TransactionStatus.COMPLETED,
        },
      });

      const isFirstTx = txCount < feeConfig.firstTxFreeCount;

      // Calcular fees con FX rate actual
      const calculation = await feeCalculationService.calculate(
        paymentLink.amountUsd,
        feeConfig,
        isFirstTx
      );

      // 4. Crear transacción en estado PENDING
      const transaction = await this.prisma.transaction.create({
        data: {
          paymentLinkId,
          status: TransactionStatus.PENDING,
          cardToken,
          idempotencyKey,
          amountUsd: calculation.totalChargeUsd,
          amountMxn: calculation.recipientAmountMxn,
          fxRateApplied: calculation.fxRateWithMarkup,
          feesTotalUsd: calculation.fees.totalFeesUsd,
          metadata: metadata as Prisma.JsonObject,
        },
      });

      // 5. Ejecutar orquestación de PSP
      const chargeRequest: PSPChargeRequest = {
        amount: Math.round(calculation.totalChargeUsd * 100), // En centavos
        currency: 'usd',
        token: cardToken as string,
        idempotencyKey: idempotencyKey as string,
        metadata: metadata as Prisma.JsonObject,
      };

      const orchestrationResult = await this.orchestrationService.executeCharge(
        pspProvider,
        chargeRequest,
        transaction.id
      );

      // 6. Persistir intentos de PSP
      await this.orchestrationService.persistAttempts(transaction.id, orchestrationResult.attempts);

      // 7. Actualizar transacción según resultado
      let finalStatus: TransactionStatus;
      let failureReason: string | null = null;

      if (orchestrationResult.success) {
        finalStatus = TransactionStatus.COMPLETED;

        // Marcar payment link como completado si se desea (one-time use)
        // await this.prisma.paymentLink.update({
        //   where: { id: paymentLinkId },
        //   data: { status: PaymentLinkStatus.COMPLETED },
        // });
      } else {
        finalStatus = TransactionStatus.FAILED;
        failureReason =
          orchestrationResult.finalResponse?.errorMessage || 'Payment failed';
      }

      const updatedTransaction = await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: finalStatus,
          pspProvider: orchestrationResult.finalProvider,
          failureReason,
        },
      });

      // 8. Retornar respuesta
      res.json({
        transactionId: updatedTransaction.id,
        status: updatedTransaction.status,
        paymentLinkId,
        pspProvider: orchestrationResult.finalProvider,
        amountUsd: updatedTransaction.amountUsd,
        recipientAmountMxn: updatedTransaction.amountMxn,
        fxRateApplied: updatedTransaction.fxRateApplied,
        totalFeesUsd: updatedTransaction.feesTotalUsd,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper: Obtiene la configuración de fees
   */
  private getFeeConfig(paymentLink: {
    feeConfigOverride?: unknown | null;
    merchant: { feeConfigs: FeeConfiguration[] };
  }): FeeConfiguration {
    if (paymentLink.feeConfigOverride) {
      return paymentLink.feeConfigOverride as FeeConfiguration;
    }

    const defaultConfig = paymentLink.merchant.feeConfigs[0];
    if (!defaultConfig) {
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
