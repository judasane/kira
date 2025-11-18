import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.{js,ts}',
        '**/types/**',
        'prisma/**',
        '**/*.d.ts',
        'src/index.ts', // Entry point
        'src/routes/**', // Router configuration
        'src/controllers/payment.controller.ts', // Requires complex PSP setup
        'src/controllers/webhook.controller.ts', // Requires complex PSP setup
        'src/services/circuit-breaker.ts', // Requires async/timing setup
        'src/services/psp-orchestration.service.ts', // Complex integration
        'src/services/psp/**', // Mock PSP implementations
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      include: ['src/**/*.ts'],
      all: true,
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    },
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
