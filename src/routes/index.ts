import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentLinkController } from '../controllers/payment-link.controller';
import { PaymentController } from '../controllers/payment.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { HealthController } from '../controllers/health.controller';
import { validateBody } from '../middleware/validate';
import {
  createPaymentLinkSchema,
  processPaymentSchema,
  pspWebhookSchema,
} from '../validators/payment-link.validator';

export function createRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Inicializar controladores
  const paymentLinkController = new PaymentLinkController(prisma);
  const paymentController = new PaymentController(prisma);
  const webhookController = new WebhookController(prisma);
  const healthController = new HealthController(prisma);

  // ============================================================================
  // Health
  // ============================================================================
  router.get('/health', healthController.check);

  // ============================================================================
  // Payment Links
  // ============================================================================
  router.post(
    '/payment-links',
    validateBody(createPaymentLinkSchema),
    paymentLinkController.createPaymentLink
  );

  router.get('/payment-links/:id', paymentLinkController.getPaymentLink);

  // ============================================================================
  // Payments
  // ============================================================================
  router.post(
    '/payment-links/:id/payments',
    validateBody(processPaymentSchema),
    paymentController.processPayment
  );

  // ============================================================================
  // Webhooks
  // ============================================================================
  router.post(
    '/webhooks/psp',
    validateBody(pspWebhookSchema),
    webhookController.handlePSPWebhook
  );

  return router;
}
