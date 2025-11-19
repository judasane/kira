import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { config } from './config';

// Inicializar Prisma Client
const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Crear aplicación Express
const app = createApp(prisma);

// Iniciar servidor
const server = app.listen(config.port, () => {
  console.log('');
  console.log('🚀 Kira Payment Backend API');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server:      ${config.baseUrl}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`🗄️  Database:    ${config.databaseUrl ? 'Connected' : 'Not configured'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📚 API Documentation:');
  console.log(`   Swagger UI: ${config.baseUrl}/api-docs`);
  console.log('');
});

// Manejo de shutdown graceful
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('HTTP server closed');

    await prisma.$disconnect();
    console.log('Database connection closed');

    console.log('Shutdown complete. Goodbye! 👋');
    process.exit(0);
  });

  // Forzar shutdown después de 10 segundos
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
