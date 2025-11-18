import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');
  const isProduction = process.env.NODE_ENV === 'production';

  // Limpiar datos existentes (solo en dev)
  if (!isProduction) {
    await prisma.pSPAttempt.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.paymentLink.deleteMany();
    await prisma.feeConfig.deleteMany();
    await prisma.merchant.deleteMany();
    console.log('✅ Cleaned existing data');
  }

  // Verificar si ya existen merchants (para idempotencia)
  const existingMerchantsCount = await prisma.merchant.count();

  if (existingMerchantsCount > 0) {
    console.log(`ℹ️  Found ${existingMerchantsCount} existing merchant(s). Skipping seed.`);
    return;
  }

  // Crear merchant inicial (siempre, incluso en producción)
  const merchant1 = await prisma.merchant.create({
    data: {
      id: 'merchant_default',
      name: 'Kira Payments Default Merchant',
      email: 'merchant@kirapayments.com',
    },
  });

  console.log('✅ Created default merchant:', merchant1.name);

  // Crear merchant adicional solo en desarrollo
  let merchant2 = null;
  if (!isProduction) {
    merchant2 = await prisma.merchant.create({
      data: {
        id: 'merchant_demo',
        name: 'Demo Store',
        email: 'demo@store.com',
      },
    });
    console.log('✅ Created demo merchant:', merchant2.name);
  }

  // Crear fee config por defecto para merchant principal
  const feeConfig1 = await prisma.feeConfig.create({
    data: {
      merchantId: merchant1.id,
      fixedFeeUsd: 0.30,
      variableFeePercent: 0.029, // 2.9%
      fxMarkupPercent: 0.015,    // 1.5%
      firstTxFreeCount: isProduction ? 0 : 3,
      isDefault: true,
    },
  });

  console.log('✅ Created default fee config');

  // Crear fee config adicional solo en desarrollo
  if (!isProduction && merchant2) {
    await prisma.feeConfig.create({
      data: {
        merchantId: merchant2.id,
        fixedFeeUsd: 0.50,
        variableFeePercent: 0.035, // 3.5%
        fxMarkupPercent: 0.020,    // 2.0%
        firstTxFreeCount: 0,
        isDefault: true,
      },
    });
    console.log('✅ Created demo fee config');
  }

  // Crear payment links y transacciones de ejemplo solo en desarrollo
  if (!isProduction && merchant2) {
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
  }

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📊 Summary:');

  if (isProduction) {
    console.log(`   - Environment: PRODUCTION`);
    console.log(`   - Merchants: 1 (default merchant created)`);
    console.log(`   - Fee Configs: 1 (default config)`);
    console.log(`   - Payment Links: 0 (none in production)`);
    console.log(`   - Transactions: 0 (none in production)`);
    console.log('');
    console.log('✅ Production database is ready to use!');
    console.log(`   Default Merchant ID: ${merchant1.id}`);
  } else {
    console.log(`   - Environment: DEVELOPMENT`);
    console.log(`   - Merchants: 2`);
    console.log(`   - Fee Configs: 2`);
    console.log(`   - Payment Links: 3`);
    console.log(`   - Transactions: 1`);
    console.log(`   - PSP Attempts: 1`);
    console.log('');
    console.log('✅ Development database seeded with test data!');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
