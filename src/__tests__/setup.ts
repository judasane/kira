import { beforeAll, afterEach, vi } from 'vitest';

// Mock environment variables para tests
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3001';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  process.env.CHECKOUT_BASE_URL = 'http://localhost:3000';
  process.env.FX_SERVICE_BASE_RATE = '17.0';
  process.env.FX_SERVICE_JITTER_PERCENT = '0.5';
});

// Limpiar mocks después de cada test
afterEach(() => {
  vi.clearAllMocks();
});
