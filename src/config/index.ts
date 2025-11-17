import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',

  // URLs
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  checkoutBaseUrl: process.env.CHECKOUT_BASE_URL || 'http://localhost:4200',

  // FX Service Mock
  fx: {
    baseRate: parseFloat(process.env.FX_SERVICE_BASE_RATE || '18.5'),
    jitterPercent: parseFloat(process.env.FX_SERVICE_JITTER_PERCENT || '2.0'),
  },

  // PSP Mock Configuration
  psp: {
    stripe: {
      successRate: parseFloat(process.env.STRIPE_MOCK_SUCCESS_RATE || '0.85'),
    },
    adyen: {
      successRate: parseFloat(process.env.ADYEN_MOCK_SUCCESS_RATE || '0.80'),
    },
    latency: {
      min: parseInt(process.env.PSP_MOCK_LATENCY_MS_MIN || '100', 10),
      max: parseInt(process.env.PSP_MOCK_LATENCY_MS_MAX || '500', 10),
    },
  },

  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
    timeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '60000', 10),
  },
} as const;

// Validación básica
if (!config.databaseUrl && config.nodeEnv === 'production') {
  throw new Error('DATABASE_URL must be defined in production');
}

export default config;
