# Kira Payment Backend API

Sistema de payment links con orquestación de PSPs (Stripe/Adyen mock), cálculo de fees y conversión FX USD→MXN.

## 🏗️ Arquitectura

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **PSPs**: Mock de Stripe y Adyen con failover automático
- **FX**: Servicio mock con tasas en tiempo real y jitter configurable

## 🚀 Quick Start

### Prerequisitos

- Node.js 18+
- PostgreSQL 15+ (o Docker)
- npm o yarn

### Instalación Local

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd kira

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Inicializar base de datos
npx prisma migrate dev
npx prisma generate

# 5. Seed de datos iniciales
npm run prisma:seed

# 6. Iniciar servidor de desarrollo
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### Usando Docker Compose (Recomendado)

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Detener servicios
docker-compose down
```

## 📦 Deployment en Render

### Opción 1: Blueprint (render.yaml)

1. Conecta tu repositorio a Render
2. Render detectará automáticamente el `render.yaml`
3. Configura las variables de entorno necesarias
4. Deploy automático

### Opción 2: Manual

1. **Crear PostgreSQL Database**
   - Tipo: PostgreSQL
   - Nombre: `kira-payment-db`
   - Plan: Starter (o superior)

2. **Crear Web Service**
   - Tipo: Web Service
   - Runtime: Node
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && npm start`
   - Environment Variables (ver sección abajo)

3. **Variables de Entorno en Render**

```
NODE_ENV=production
PORT=10000
DATABASE_URL=<internal-database-url>
CORS_ORIGIN=*
BASE_URL=https://your-app.onrender.com
CHECKOUT_BASE_URL=https://pay.kira.com
FX_SERVICE_BASE_RATE=18.5
FX_SERVICE_JITTER_PERCENT=2.0
STRIPE_MOCK_SUCCESS_RATE=0.85
ADYEN_MOCK_SUCCESS_RATE=0.80
PSP_MOCK_LATENCY_MS_MIN=100
PSP_MOCK_LATENCY_MS_MAX=500
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MS=60000
```

## 📚 API Endpoints

### Health Check
```http
GET /health
```

### Payment Links

#### Crear Payment Link
```http
POST /payment-links
Content-Type: application/json

{
  "merchantId": "merchant_123",
  "amountUsd": 100.0,
  "description": "Pago de servicio",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

#### Obtener Payment Link (con preview de fees)
```http
GET /payment-links/{id}?withFeePreview=true
```

### Payments

#### Procesar Pago
```http
POST /payment-links/{id}/payments
Content-Type: application/json

{
  "cardToken": "tok_mock_stripe_1234",
  "pspProvider": "STRIPE",
  "idempotencyKey": "unique-key-123",
  "metadata": {
    "customerEmail": "user@example.com"
  }
}
```

### Webhooks

#### Webhook de PSP
```http
POST /webhooks/psp
Content-Type: application/json

{
  "provider": "STRIPE",
  "eventType": "payment.succeeded",
  "eventId": "evt_123",
  "data": {
    "transactionId": "tx_abc",
    "pspChargeId": "ch_xyz",
    "status": "succeeded"
  }
}
```

## 🧪 Testing

### Con cURL

```bash
# Health check
curl http://localhost:3000/health

# Crear payment link
curl -X POST http://localhost:3000/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "amountUsd": 100.0,
    "description": "Test payment"
  }'

# Obtener payment link con preview
curl http://localhost:3000/payment-links/{id}?withFeePreview=true

# Procesar pago
curl -X POST http://localhost:3000/payment-links/{id}/payments \
  -H "Content-Type: application/json" \
  -d '{
    "cardToken": "tok_mock_stripe_test",
    "pspProvider": "STRIPE",
    "idempotencyKey": "test-key-001"
  }'
```

### Con Postman

Importa la colección desde el Swagger (OpenAPI spec) incluido en la documentación.

## 🗄️ Base de Datos

### Migraciones

```bash
# Crear migración
npx prisma migrate dev --name descripcion_cambio

# Aplicar migraciones en producción
npx prisma migrate deploy

# Reset de base de datos (desarrollo)
npm run db:reset
```

### Prisma Studio

```bash
# Abrir GUI de base de datos
npm run prisma:studio
```

## 🔧 Configuración

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `development` |
| `PORT` | Puerto del servidor | `3000` |
| `DATABASE_URL` | Connection string de PostgreSQL | - |
| `CORS_ORIGIN` | Origen permitido para CORS | `http://localhost:4200` |
| `FX_SERVICE_BASE_RATE` | Tasa base USD→MXN | `18.5` |
| `FX_SERVICE_JITTER_PERCENT` | Variación % de la tasa | `2.0` |
| `STRIPE_MOCK_SUCCESS_RATE` | % éxito de Stripe | `0.85` |
| `ADYEN_MOCK_SUCCESS_RATE` | % éxito de Adyen | `0.80` |
| `PSP_MOCK_LATENCY_MS_MIN` | Latencia mínima PSP | `100` |
| `PSP_MOCK_LATENCY_MS_MAX` | Latencia máxima PSP | `500` |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Fallos antes de abrir circuito | `5` |
| `CIRCUIT_BREAKER_TIMEOUT_MS` | Timeout del circuit breaker | `60000` |

## 📊 Estructura del Proyecto

```
kira/
├── prisma/
│   ├── schema.prisma          # Schema de base de datos
│   └── seed.ts                # Datos iniciales
├── src/
│   ├── config/                # Configuración
│   ├── controllers/           # Controladores de rutas
│   ├── middleware/            # Middleware de Express
│   ├── routes/                # Definición de rutas
│   ├── services/              # Lógica de negocio
│   │   ├── psp/              # Mocks de PSPs
│   │   ├── circuit-breaker.ts
│   │   ├── fee-calculation.service.ts
│   │   ├── fx.service.ts
│   │   └── psp-orchestration.service.ts
│   ├── types/                 # Tipos TypeScript
│   ├── validators/            # Validadores Zod
│   ├── app.ts                 # Configuración Express
│   └── index.ts               # Entry point
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── render.yaml
```

## 🎯 Características Clave

### 1. Orquestación de PSPs con Failover
- Intento primario contra PSP seleccionado
- Failover automático al PSP secundario en caso de error técnico
- Circuit breaker para prevenir llamadas repetidas a PSPs fallando

### 2. Motor de Fees
- Fee fija en USD
- Fee variable (% del monto)
- Markup de FX
- Incentivos de primera transacción

### 3. FX en Tiempo Real
- Tasa de cambio con jitter configurable
- Simula volatilidad del mercado
- Preview vs ejecución puede variar ligeramente

### 4. Idempotencia
- Clave de idempotencia en pagos
- Previene dobles cobros

### 5. Auditabilidad Completa
- Todos los intentos de PSP se registran
- Historial completo de transacciones
- Métricas de latencia

## 🔒 Seguridad

### PCI Compliance
- **Tokenización**: El frontend simula tokenización; el backend NUNCA recibe datos de tarjeta
- **Tokens mock**: Formato `tok_mock_{psp}_{uuid}`
- **Nivel SAQ A**: No se procesa ni almacena PAN, CVV u otros datos sensibles

### CORS
- Configurable por variable de entorno
- Por defecto restrictivo en producción

### Validación
- Todos los inputs validados con Zod
- Sanitización automática

## 📝 Notas de Implementación

### Limitaciones Conocidas
1. **Caché en memoria**: Fee configs se cachean en RAM (no Redis)
2. **Circuit breaker simple**: No persiste estado entre reinicios
3. **Webhooks sin firma**: No se valida HMAC (solo para mock)
4. **Idempotencia limitada**: Solo en endpoint de pago

### Próximos Pasos
- [ ] Implementar frontend Angular
- [ ] Agregar autenticación de merchants
- [ ] Panel de administración
- [ ] Métricas y monitoring (Prometheus)
- [ ] Tests automatizados
- [ ] CI/CD pipeline

## 📄 Licencia

MIT

## 👥 Autor

Kira Team
