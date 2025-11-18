# Kira Payment Orchestrator API 🦉

> **⚠️ Contexto del Desafío (24h Sprint):**
> Este proyecto fue desarrollado bajo un timebox estricto de **24 horas**.
> Debido a esta restricción, se tomó la decisión estratégica de **priorizar la robustez del Backend, la integridad financiera (ACID) y la lógica de orquestación** sobre la implementación del Frontend y la infraestructura compleja (Terraform).
>
> El objetivo fue entregar un núcleo transaccional sólido capaz de manejar dinero, fallos y conversiones de divisa de forma segura.

Backend de orquestación de pagos Cross-Border (USD → MXN) que gestiona Payment Links, cálculo de fees complejos, conversión de divisas en tiempo real y enrutamiento inteligente entre PSPs (Stripe y Adyen) con failover automático.

## 🏗️ Arquitectura y Diseño

El sistema sigue una **Clean Architecture** simplificada, utilizando inyección de dependencias y separación de responsabilidades (Controladores, Servicios de Dominio, Repositorios vía Prisma).

### Diagrama de Flujo de Datos

```mermaid
graph TD
    Client[Cliente / API Consumer] -->|POST /payments| API[API Gateway / Express]
    API -->|Validate| DB[(PostgreSQL)]
    API -->|Calculate| Fees[Fee Engine Service]
    Fees -->|Get Rate| FX[FX Mock Service]
    API -->|Charge| Orch[PSP Orchestrator]
    
    subgraph "Failover System"
        Orch -->|Primary Attempt| CB1[Circuit Breaker: Stripe]
        CB1 -->|Network Call| Stripe[Stripe Mock]
        
        Stripe -.->|Error/Timeout| Orch
        Orch -->|Failover Attempt| CB2[Circuit Breaker: Adyen]
        CB2 -->|Network Call| Adyen[Adyen Mock]
    end
    
    Orch -->|Result| DB
```

### Decisiones Técnicas Clave (Strategic Trade-offs)

1.  **Backend First vs. Full Stack:**
    *   **Decisión:** Invertir el 90% del tiempo en el motor de fees, concurrencia y manejo de errores de PSPs.
    *   **Razón:** En Fintech, un error de UI es una molestia; un error de cálculo o un doble cobro es una pérdida financiera y legal. El riesgo técnico más alto reside en la orquestación.

2.  **Infraestructura (Render Blueprint vs. Terraform):**
    *   **Decisión:** Uso de `render.yaml` (Infrastructure as Code declarativa) en lugar de módulos de Terraform.
    *   **Razón:** Para un MVP de 24h, Render ofrece despliegue de cero configuración, base de datos gestionada y SSL automático. Esto permitió centrarse en la lógica de negocio sin sacrificar la reproducibilidad del entorno.

3.  **Manejo de FX y Fees:**
    *   **Estrategia:** Tasas en tiempo real con Jitter (volatilidad simulada).
    *   **Implementación:** El `FeeCalculationService` encapsula toda la lógica financiera. Se utilizan tipos `Decimal` en base de datos para evitar errores de punto flotante en los cálculos monetarios.

4.  **Orquestación y Resiliencia:**
    *   **Pattern:** Implementación de **Circuit Breaker** en memoria. Si un PSP falla repetidamente, el sistema deja de intentarlo temporalmente para evitar latencia en cascada, haciendo failover inmediato al proveedor secundario.

## 🚀 Características Implementadas

*   ✅ **Motor de Fees Dinámico:** Soporta fee fija, fee variable (%) y markup sobre FX. Incluye lógica para incentivos (ej. primeras N transacciones gratis).
*   ✅ **Dual-PSP Routing:** Intento primario (Stripe) con failover automático a secundario (Adyen) en caso de error técnico (5xx/Timeout), respetando errores de negocio (Decline 402).
*   ✅ **Circuit Breaker:** Protección contra proveedores caídos.
*   ✅ **Idempotencia:** Prevención de dobles cobros mediante `idempotencyKey`.
*   ✅ **Simulación Realista:** Mocks de PSPs con latencia variable y tasas de éxito configurables vía variables de entorno.
*   ✅ **Persistencia Robusta:** Modelo relacional normalizado con auditoría completa de intentos (`psp_attempts`).

## 🛠️ Instalación y Ejecución

### Prerrequisitos
*   Node.js 18+
*   Docker & Docker Compose (Recomendado)

### Opción A: Docker Compose (La forma rápida)

Levanta la base de datos y la API con un solo comando.

```bash
# 1. Levantar servicios
docker-compose up -d --build

# 2. Ver logs (para ver la actividad de los mocks)
docker-compose logs -f api
```

La API estará disponible en: `http://localhost:3000`

### Opción B: Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env

# 3. Levantar base de datos (requiere PostgreSQL local o en Docker)
# Asegúrate de que DATABASE_URL en .env apunte a tu DB

# 4. Ejecutar migraciones y seed
npx prisma migrate dev
npm run prisma:seed

# 5. Iniciar en modo watch
npm run dev
```

## 🧪 Guía de Pruebas (API Walkthrough)

Dado que no hay UI, utiliza esta guía para probar el flujo completo (End-to-End) usando `curl` o Postman.

### 1. Health Check
Verificar que el sistema y la DB están online.
```bash
curl http://localhost:3000/health
```

### 2. Crear un Payment Link
Simula la acción del merchant creando un cobro.
```bash
curl -X POST http://localhost:3000/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_default", 
    "amountUsd": 100.00, 
    "description": "Consultoría Técnica",
    "feeConfigOverride": {
        "fixedFeeUsd": 0.50,
        "variableFeePercent": 0.03,
        "fxMarkupPercent": 0.015,
        "firstTxFreeCount": 0
    }
  }'
```
*Copia el `id` de la respuesta para los siguientes pasos.*

### 3. Obtener Preview de Fees (Simulación de Carga de Checkout)
El frontend llamaría a esto para mostrar al usuario cuánto pagará y cuánto recibirá el merchant en MXN.
```bash
# Reemplaza LINK_ID con el ID obtenido en el paso anterior
curl "http://localhost:3000/payment-links/LINK_ID?withFeePreview=true"
```
> **Observa:** El campo `feePreview` muestra el desglose y la `fxRate` actual (que varía ligeramente en cada llamada por el Jitter simulado).

### 4. Procesar el Pago (Happy Path)
Simula que el usuario ingresó su tarjeta.
```bash
curl -X POST "http://localhost:3000/payment-links/LINK_ID/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "cardToken": "tok_mock_stripe_visa_001",
    "pspProvider": "STRIPE",
    "idempotencyKey": "unique_key_12345",
    "metadata": { "email": "cliente@ejemplo.com" }
  }'
```

### 5. Simular Fallo y Failover (Chaos Testing)
Para probar la resiliencia, puedes configurar las variables de entorno en `docker-compose.yml` o `.env`:

*   `STRIPE_MOCK_SUCCESS_RATE=0.0` (Forzar fallo de Stripe)
*   `ADYEN_MOCK_SUCCESS_RATE=1.0` (Asegurar éxito de Adyen)

Al reintentar el pago (con una nueva `idempotencyKey`), verás en la respuesta:
*   `pspProvider: "ADYEN"` (Indica que hubo failover exitoso).
*   En los logs de la consola verás: `[Orchestration] Primary STRIPE failed... attempting failover to ADYEN`.

## 🔮 Roadmap (Siguientes Pasos)

Si el proyecto continuara hacia producción, estas serían las prioridades inmediatas:

1.  **Frontend SPA:** Implementar la interfaz de checkout en Angular/React consumiendo los endpoints existentes.
2.  **Tests de Integración (E2E):** Implementar suite de pruebas con `Supertest` que valide automáticamente los escenarios de failover y concurrencia.
3.  **Seguridad:** Implementar validación de firmas HMAC para los Webhooks y autenticación JWT para los endpoints de creación de links.
4.  **Infraestructura Cloud:** Migrar de Render a Terraform (AWS) con ECS para la API y RDS Multi-AZ para la base de datos.

## 📄 Estructura del Proyecto

```
src/
├── config/             # Configuración y env vars
├── controllers/        # Manejo de HTTP requests
├── services/           # Lógica de Negocio
│   ├── psp/            # Mocks de Stripe y Adyen
│   ├── fee-calculation # Motor de Fees
│   ├── fx.service.ts   # Mock de tipo de cambio
│   └── psp-orchestration # Lógica de Failover/Routing
├── validators/         # Schemas Zod
├── middleware/         # Error handling y validación
└── index.ts            # Entry point
```
