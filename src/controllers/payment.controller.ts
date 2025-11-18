import { Request, Response, NextFunction } from 'express';
import {
  PrismaClient,
  PaymentLinkStatus,
  TransactionStatus,
  Prisma,
} from '@prisma/client';
import { ProcessPaymentDTO } from '../validators/payment-link.validator';
import { feeCalculationService } from '../services/fee-calculation.service';
import { PSPOrchestrationService } from '../services/psp-orchestration.service';
import { PSPChargeRequest } from '../types';
import { getFeeConfig } from '../utils/fee-config.utils';

export class PaymentController {
  private prisma: PrismaClient;
  private orchestrationService: PSPOrchestrationService;

  constructor(prisma: PrismaClient, orchestrationService: PSPOrchestrationService) {
    this.prisma = prisma;
    this.orchestrationService = orchestrationService;
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

      const existingTx = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
      });

      if (existingTx) {
        const error = new Error('Payment already processed with this idempotency key');
        error.name = 'ConflictError';
        throw error;
      }

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

      if (paymentLink.status !== PaymentLinkStatus.ACTIVE) {
        const error = new Error(`Payment link is not active (status: ${paymentLink.status})`);
        error.name = 'BadRequestError';
        throw error;
      }

      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        await this.prisma.paymentLink.update({
          where: { id: paymentLinkId },
          data: { status: PaymentLinkStatus.EXPIRED },
        });
        const error = new Error('Payment link has expired');
        error.name = 'BadRequestError';
        throw error;
      }

      const feeConfig = getFeeConfig(paymentLink);

      const txCount = await this.prisma.transaction.count({
        where: {
          paymentLink: {
            merchantId: paymentLink.merchantId,
          },
          status: TransactionStatus.COMPLETED,
        },
      });

      const isFirstTx = txCount < feeConfig.firstTxFreeCount;

      const calculation = await feeCalculationService.calculate(
        Number(paymentLink.amountUsd),
        feeConfig,
        isFirstTx
      );

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

      const chargeRequest: PSPChargeRequest = {
        amount: Math.round(calculation.totalChargeUsd * 100),
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

      await this.orchestrationService.persistAttempts(transaction.id, orchestrationResult.attempts);

      let finalStatus: TransactionStatus;
      let failureReason: string | null = null;

      if (orchestrationResult.success) {
        finalStatus = TransactionStatus.COMPLETED;
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

      res.json({
        transactionId: updatedTransaction.id,
        status: updatedTransaction.status,
        paymentLinkId,
        pspProvider: orchestrationResult.finalProvider,
        amountUsd: updatedTransaction.amountUsd.toNumber(),
        recipientAmountMxn: updatedTransaction.amountMxn?.toNumber(),
        fxRateApplied: updatedTransaction.fxRateApplied?.toNumber(),
        totalFeesUsd: updatedTransaction.feesTotalUsd?.toNumber(),
      });
    } catch (error) {
      next(error);
    }
  };
}
