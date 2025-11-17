# Guía Rápida de Deployment en Render

## Opción Automática (Blueprint)

### 1. Preparación
- Asegúrate de que tu código esté pusheado a GitHub/GitLab
- Crea una cuenta en render.com

### 2. Crear Blueprint
1. Dashboard de Render → "New +" → "Blueprint"
2. Conecta tu repositorio
3. Selecciona el repo "kira"
4. Render detectará `render.yaml` automáticamente
5. Click en "Apply"

### 3. Esperar deployment
- Base de datos PostgreSQL se creará primero (~3 min)
- Luego el servicio API (~5-7 min)
- Ambos deben mostrar estado "Live" (círculo verde)

### 4. Obtener la URL
- Ve al servicio "kira-payment-api"
- Copia la URL (ej: https://kira-payment-api.onrender.com)

### 5. Actualizar variable BASE_URL
1. En el servicio "kira-payment-api"
2. Ve a "Environment"
3. Edita `BASE_URL` con tu URL real
4. Guarda cambios (esto reiniciará el servicio)

### 6. Verificar
```bash
curl https://TU-URL.onrender.com/health
```

### 7. Ejecutar seed (opcional)
1. Servicio → "Shell"
2. Ejecutar: `npm run prisma:seed`

---

## Opción Manual

### 1. Crear PostgreSQL Database
1. Dashboard → "New +" → "PostgreSQL"
2. Configurar:
   - Name: `kira-payment-db`
   - Database: `kira_payments`
   - Region: Oregon
   - Plan: Starter ($7/mo) o Free
3. "Create Database"
4. Copiar "Internal Database URL"

### 2. Crear Web Service
1. Dashboard → "New +" → "Web Service"
2. Conectar repositorio
3. Configurar:
   - Name: `kira-payment-api`
   - Region: Oregon (misma que DB)
   - Runtime: Node
   - Build Command:
     ```
     npm install && npx prisma generate && npm run build
     ```
   - Start Command:
     ```
     npx prisma migrate deploy && npm start
     ```

### 3. Agregar Variables de Entorno

En "Environment" del Web Service, agregar:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=[pegar Internal Database URL aquí]
CORS_ORIGIN=*
BASE_URL=https://tu-servicio.onrender.com
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

### 4. Deploy
1. "Create Web Service"
2. Esperar a que esté "Live"

---

## Testing Post-Deployment

### 1. Health Check
```bash
curl https://tu-url.onrender.com/health
```

### 2. Crear Payment Link
```bash
curl -X POST https://tu-url.onrender.com/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "amountUsd": 100.0,
    "description": "Test payment"
  }'
```

### 3. Obtener Payment Link
```bash
curl https://tu-url.onrender.com/payment-links/[ID-DEL-LINK]
```

---

## Troubleshooting

### Error: "Database connection failed"
- Verifica que uses la **Internal Database URL** (no External)
- Asegúrate de que DB y API estén en la misma región

### Error: "Cannot find module '@prisma/client'"
- Verifica que el Build Command incluya `npx prisma generate`
- Re-deploy manual desde dashboard

### Servicio no inicia
1. Ve a "Logs" en el dashboard
2. Busca errores específicos
3. Verifica que todas las env vars estén configuradas

### Migraciones fallan
1. Ve a "Shell"
2. Ejecuta: `npx prisma migrate deploy`

---

## Costos

- PostgreSQL Starter: $7/mes
- Web Service Starter: $7/mes
- **Total: $14/mes**

Plan Free disponible para pruebas (limitaciones: sleep después de inactividad)

---

## Próximos pasos

1. Configura auto-deploy en tu rama principal
2. Agrega custom domain (opcional)
3. Configura alertas de monitoreo
4. Implementa frontend Angular
