import { Request, Response, NextFunction } from 'express';
import { PrismaClient, TransactionStatus } from '@prisma/client';
import { PSPWebhookDTO } from '../validators/payment-link.validator';

/**
 * Controlador para recibir y procesar webhooks de PSPs.
 * Maneja notificaciones asíncronas de estado de transacciones.
 *
 * @example
 * ```typescript
 * import { WebhookController } from './controllers/webhook.controller';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const controller = new WebhookController(prisma);
 *
 * // Usar en un router de Express
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
   * Recibe webhooks de PSPs mock
   *
   * @param req - Request de Express con PSPWebhookDTO en body
   * @param res - Response de Express
   * @param next - NextFunction para manejo de errores
   */
  handlePSPWebhook = async (
    req: Request<object, object, PSPWebhookDTO>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { provider, eventType, data } = req.body;

      console.log(`[Webhook] Received ${eventType} from ${provider}:`, data);

      // Validar que tengamos un transactionId
      if (!data.transactionId) {
        const error = new Error('Missing transactionId in webhook data');
        error.name = 'BadRequestError';
        throw error;
      }

      // Buscar la transacción
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: data.transactionId },
      });

      if (!transaction) {
        console.warn(`[Webhook] Transaction ${data.transactionId} not found`);
        // Responder OK de todas formas (idempotencia)
        res.json({ received: true, processed: false });
        return;
      }

      // Verificar idempotencia: si ya está en estado final, ignorar
      if (
        transaction.status === TransactionStatus.COMPLETED ||
        transaction.status === TransactionStatus.FAILED
      ) {
        console.log(`[Webhook] Transaction ${transaction.id} already in final state, ignoring`);
        res.json({ received: true, processed: false });
        return;
      }

      // Procesar según el tipo de evento
      let newStatus: TransactionStatus | null = null;
      let failureReason: string | null = null;

      if (eventType === 'payment.succeeded' || data.status === 'succeeded') {
        newStatus = TransactionStatus.COMPLETED;
      } else if (eventType === 'payment.failed' || data.status === 'failed') {
        newStatus = TransactionStatus.FAILED;
        failureReason = 'Payment failed (webhook notification)';
      }

      // Actualizar transacción si hay cambio de estado
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
