import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Limpiar datos existentes (solo en dev)
  if (process.env.NODE_ENV !== 'production') {
    await prisma.pSPAttempt.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.paymentLink.deleteMany();
    await prisma.feeConfig.deleteMany();
    await prisma.merchant.deleteMany();
    console.log('✅ Cleaned existing data');
  }

  // Crear merchants de prueba
  const merchant1 = await prisma.merchant.create({
    data: {
      id: 'merchant_123',
      name: 'Demo Store',
      email: 'demo@store.com',
    },
  });

  const merchant2 = await prisma.merchant.create({
    data: {
      id: 'merchant_456',
      name: 'Tech Solutions Inc',
      email: 'info@techsolutions.com',
    },
  });

  console.log('✅ Created merchants:', merchant1.name, merchant2.name);

  // Crear fee configs por defecto
  const feeConfig1 = await prisma.feeConfig.create({
    data: {
      merchantId: merchant1.id,
      fixedFeeUsd: 0.30,
      variableFeePercent: 0.029, // 2.9%
      fxMarkupPercent: 0.015,    // 1.5%
      firstTxFreeCount: 3,
      isDefault: true,
    },
  });

  const feeConfig2 = await prisma.feeConfig.create({
    data: {
      merchantId: merchant2.id,
      fixedFeeUsd: 0.50,
      variableFeePercent: 0.035, // 3.5%
      fxMarkupPercent: 0.020,    // 2.0%
      firstTxFreeCount: 0,
      isDefault: true,
    },
  });

  console.log('✅ Created fee configs');

  // Crear algunos payment links de ejemplo
  const paymentLink1 = await prisma.paymentLink.create({
    data: {
      merchantId: merchant1.id,
      amountUsd: 100.00,
      description: 'Pago de servicio de consultoría',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
    },
  });

  const paymentLink2 = await prisma.paymentLink.create({
    data: {
      merchantId: merchant1.id,
      amountUsd: 250.00,
      description: 'Suscripción Premium - Anual',
      status: 'ACTIVE',
    },
  });

  const paymentLink3 = await prisma.paymentLink.create({
    data: {
      merchantId: merchant2.id,
      amountUsd: 1500.00,
      description: 'Licencia de Software Empresarial',
      status: 'ACTIVE',
      feeConfigOverride: {
        fixedFeeUsd: 1.00,
        variableFeePercent: 0.025,
        fxMarkupPercent: 0.010,
        firstTxFreeCount: 0,
      },
    },
  });

  console.log('✅ Created payment links:', paymentLink1.id, paymentLink2.id, paymentLink3.id);

  // Crear una transacción completada de ejemplo
  const transaction1 = await prisma.transaction.create({
    data: {
      paymentLinkId: paymentLink1.id,
      status: 'COMPLETED',
      pspProvider: 'STRIPE',
      amountUsd: 103.20,
      amountMxn: 1909.20,
      fxRateApplied: 18.5,
      feesTotalUsd: 3.20,
      cardToken: 'tok_mock_stripe_completed_example',
      idempotencyKey: 'seed_tx_1',
      metadata: {
        customerEmail: 'customer@example.com',
        customerName: 'Juan Pérez',
      },
    },
  });

  // Crear PSP attempt para la transacción
  await prisma.pSPAttempt.create({
    data: {
      transactionId: transaction1.id,
      pspProvider: 'STRIPE',
      isPrimary: true,
      status: 'SUCCESS',
      statusCode: 200,
      latencyMs: 234,
      pspChargeId: 'ch_mock_1234567890',
      requestPayload: {
        amount: 10320,
        currency: 'usd',
        token: 'tok_mock_stripe_completed_example',
      },
      responsePayload: {
        id: 'ch_mock_1234567890',
        status: 'succeeded',
        amount: 10320,
      },
    },
  });

  console.log('✅ Created example completed transaction');

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Merchants: 2`);
  console.log(`   - Fee Configs: 2`);
  console.log(`   - Payment Links: 3`);
  console.log(`   - Transactions: 1`);
  console.log(`   - PSP Attempts: 1`);
  console.log('');
  console.log('🔗 Example Payment Links:');
  console.log(`   - ${paymentLink1.id} ($${paymentLink1.amountUsd})`);
  console.log(`   - ${paymentLink2.id} ($${paymentLink2.amountUsd})`);
  console.log(`   - ${paymentLink3.id} ($${paymentLink3.amountUsd})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
