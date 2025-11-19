import { Request, Response, NextFunction } from 'express';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { PSPWebhookDTO } from '../validators/payment-link.validator';

/**
 * Controller for receiving and processing PSP webhooks.
 * Handles asynchronous transaction status notifications.
 *
 * @example
 * ```typescript
 * import { WebhookController } from './controllers/webhook.controller';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const controller = new WebhookController(prisma);
 *
 * // Use in an Express router
 * router.post('/webhooks/psp', controller.handlePSPWebhook);
 * ```
 */
export class WebhookController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * POST /webhooks/psp
   * Receives webhooks from mock PSPs
   *
   * @param req - Express Request with PSPWebhookDTO in body
   * @param res - Express Response
   * @param next - NextFunction for error handling
   */
  handlePSPWebhook = async (
    req: Request<object, object, PSPWebhookDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { provider, eventType, data } = req.body;

      console.log(`[Webhook] Received ${eventType} from ${provider}:`, data);

      // Validate that we have a transactionId
      if (!data.transactionId) {
        const error = new Error('Missing transactionId in webhook data');
        error.name = 'BadRequestError';
        throw error;
      }

      // Search for the transaction
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: data.transactionId },
      });

      if (!transaction) {
        console.warn(`[Webhook] Transaction ${data.transactionId} not found`);
        // Respond OK anyway (idempotency)
        res.json({ received: true, processed: false });
        return;
      }

      // Verify idempotency: if already in final state, ignore
      if (
        transaction.status === TransactionStatus.COMPLETED ||
        transaction.status === TransactionStatus.FAILED
      ) {
        console.log(`[Webhook] Transaction ${transaction.id} already in final state, ignoring`);
        res.json({ received: true, processed: false });
        return;
      }

      // Process according to event type
      let newStatus: TransactionStatus | null = null;
      let failureReason: string | null = null;

      if (eventType === 'payment.succeeded' || data.status === 'succeeded') {
        newStatus = TransactionStatus.COMPLETED;
      } else if (eventType === 'payment.failed' || data.status === 'failed') {
        newStatus = TransactionStatus.FAILED;
        failureReason = 'Payment failed (webhook notification)';
      }

      // Update transaction if there is a state change
      if (newStatus) {
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: newStatus,
            failureReason,
          },
        });

        console.log(`[Webhook] Updated transaction ${transaction.id} to status ${newStatus}`);
      }

      res.json({ received: true, processed: true });
    } catch (error) {
      next(error);
    }
  };
}
