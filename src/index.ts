import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { config } from './config';

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Create Express application
const app = createApp(prisma);

// Start server
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

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('HTTP server closed');

    await prisma.$disconnect();
    console.log('Database connection closed');

    console.log('Shutdown complete. Goodbye! 👋');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught errors handling
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
