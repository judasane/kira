import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentLinkStatus, TransactionStatus, Prisma } from '@prisma/client';
import { ProcessPaymentDTO } from '../validators/payment-link.validator';
import { feeCalculationService } from '../services/fee-calculation.service';
import { PSPOrchestrationService } from '../services/psp-orchestration.service';
import { PSPChargeRequest } from '../types';
import { getFeeConfig } from '../utils/fee-config.utils';

/**
 * Controller for payment processing.
 * Handles transaction execution on payment links with PSP orchestration.
 *
 * @example
 * ```typescript
 * import { PaymentController } from './controllers/payment.controller';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const controller = new PaymentController(prisma);
 *
 * // Use in an Express router
 * router.post('/payment-links/:id/payments', controller.processPayment);
 * ```
 */
export class PaymentController {
  private prisma: PrismaClient;
  private orchestrationService: PSPOrchestrationService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.orchestrationService = new PSPOrchestrationService(prisma);
  }

  /**
   * POST /payment-links/:id/payments
   * Process a payment on a payment link
   *
   * @param req - Express Request with id in params and ProcessPaymentDTO in body
   * @param res - Express Response
   * @param next - NextFunction for error handling
   */
  processPayment = async (
    req: Request<{ id: string }, object, ProcessPaymentDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id: paymentLinkId } = req.params;
      const { cardToken, pspProvider, idempotencyKey, metadata } = req.body;

      // 1. Validate idempotency
      const existingTx = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
      });

      if (existingTx) {
        // Already exists, return the existing transaction
        const error = new Error('Payment already processed with this idempotency key');
        error.name = 'ConflictError';
        throw error;
      }

      // 2. Get and validate the payment link
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

      // Validate link status
      if (paymentLink.status !== PaymentLinkStatus.ACTIVE) {
        const error = new Error(`Payment link is not active (status: ${paymentLink.status})`);
        error.name = 'BadRequestError';
        throw error;
      }

      // Validate expiration
      if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
        await this.prisma.paymentLink.update({
          where: { id: paymentLinkId },
          data: { status: PaymentLinkStatus.EXPIRED },
        });
        const error = new Error('Payment link has expired');
        error.name = 'BadRequestError';
        throw error;
      }

      // 3. Get fee config and calculate fees
      const feeConfig = getFeeConfig(paymentLink);

      // Count transactions for incentive
      const txCount = await this.prisma.transaction.count({
        where: {
          paymentLink: {
            merchantId: paymentLink.merchantId,
          },
          status: TransactionStatus.COMPLETED,
        },
      });

      const isFirstTx = txCount < feeConfig.firstTxFreeCount;

      // Calculate fees with current FX rate
      const calculation = await feeCalculationService.calculate(
        Number(paymentLink.amountUsd),
        feeConfig,
        isFirstTx
      );

      // 4. Create transaction in PENDING status
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

      // 5. Execute PSP orchestration
      const chargeRequest: PSPChargeRequest = {
        amount: Math.round(calculation.totalChargeUsd * 100), // In cents
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

      // 6. Persist PSP attempts
      await this.orchestrationService.persistAttempts(transaction.id, orchestrationResult.attempts);

      // 7. Update transaction according to result
      let finalStatus: TransactionStatus;
      let failureReason: string | null = null;

      if (orchestrationResult.success) {
        finalStatus = TransactionStatus.COMPLETED;

        // Mark payment link as completed if desired (one-time use)
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

      // 8. Return response
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
}
