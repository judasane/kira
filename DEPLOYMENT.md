# Guía de Deployment en Render

## Prerrequisitos

1. Cuenta en [Render.com](https://render.com)
2. Repositorio de Git (GitHub, GitLab o Bitbucket)
3. Código pusheado al repositorio

## Opción 1: Deployment Automático con Blueprint

### Paso 1: Conectar Repositorio

1. Accede a [Render Dashboard](https://dashboard.render.com)
2. Click en "New +" → "Blueprint"
3. Conecta tu repositorio de Git
4. Render detectará automáticamente el archivo `render.yaml`

### Paso 2: Configurar Variables de Entorno

Render creará automáticamente:
- Un servicio PostgreSQL (`kira-payment-db`)
- Un servicio web (`kira-payment-api`)

Las variables de entorno ya están definidas en `render.yaml`, pero verifica:

- `DATABASE_URL`: Se conectará automáticamente a la DB
- `BASE_URL`: Actualiza con tu URL de Render (ej. `https://kira-payment-api.onrender.com`)

### Paso 3: Deploy

1. Click en "Apply"
2. Render iniciará el build y deployment
3. Espera a que ambos servicios estén "Live" (círculo verde)

### Paso 4: Ejecutar Migraciones y Seed

Las migraciones se ejecutan automáticamente en el comando de inicio.

Para ejecutar el seed manualmente:

```bash
# Desde el dashboard de Render, ve a Shell y ejecuta:
npm run prisma:seed
```

## Opción 2: Deployment Manual

### Paso 1: Crear Base de Datos PostgreSQL

1. Dashboard → "New +" → "PostgreSQL"
2. Configura:
   - **Name**: `kira-payment-db`
   - **Database**: `kira_payments`
   - **User**: `postgres` (default)
   - **Region**: Oregon (o tu preferencia)
   - **Plan**: Starter ($7/month) o Free ($0/month para pruebas)
3. Click "Create Database"
4. Espera a que esté "Available"
5. Copia la **Internal Database URL** (la usaremos después)

### Paso 2: Crear Web Service

1. Dashboard → "New +" → "Web Service"
2. Conecta tu repositorio
3. Configura:
   - **Name**: `kira-payment-api`
   - **Region**: Oregon (misma que la DB)
   - **Branch**: `main` (o tu branch principal)
   - **Runtime**: Node
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma migrate deploy && npm start
     ```
   - **Plan**: Starter ($7/month) o Free ($0/month)

### Paso 3: Configurar Variables de Entorno

En la sección "Environment", agrega:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=<pega-aqui-la-internal-database-url>
CORS_ORIGIN=*
BASE_URL=https://kira-payment-api.onrender.com
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

**Importante**: Reemplaza `https://kira-payment-api.onrender.com` con la URL real que Render te asigne.

### Paso 4: Deploy

1. Click "Create Web Service"
2. Render comenzará el build automáticamente
3. Monitorea los logs en la pestaña "Logs"
4. Espera a que el servicio esté "Live"

### Paso 5: Verificar Deployment

Accede a tu URL y verifica el healthcheck:

```bash
curl https://tu-app.onrender.com/health
```

Deberías recibir:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T...",
  "database": "connected"
}
```

### Paso 6: Seed de Datos (Opcional)

1. Ve a tu servicio en Render Dashboard
2. Click en "Shell" (pestaña superior)
3. Ejecuta:
   ```bash
   npm run prisma:seed
   ```

## Configuración Adicional

### Health Check

Render verificará automáticamente la ruta `/health` cada 30 segundos.

### Auto-Deploy

Por defecto, Render re-deployará automáticamente cuando hagas push a la rama configurada.

Para deshabilitar:
1. Service Settings → "Auto-Deploy"
2. Toggle OFF

### Logs

Para ver logs en tiempo real:
```bash
# Desde tu terminal local
curl https://api.render.com/v1/services/<service-id>/logs
```

O desde el dashboard: Service → Logs

### Escalado

Para aumentar recursos:
1. Service Settings → "Instance Type"
2. Selecciona un plan superior
3. Save Changes

## Troubleshooting

### Error: "Cannot find module '@prisma/client'"

Solución:
1. Verifica que el Build Command incluya `npx prisma generate`
2. Re-deploy manual desde el dashboard

### Error: "Database connection failed"

Solución:
1. Verifica que `DATABASE_URL` esté configurada correctamente
2. Asegúrate de usar la **Internal Database URL** (no la External)
3. Verifica que la DB y el servicio estén en la misma región

### Error: "Migrations failed"

Solución:
1. Ve a Shell en el servicio
2. Ejecuta manualmente:
   ```bash
   npx prisma migrate deploy
   ```

### Servicio no inicia

Revisa los logs:
1. Service → Logs
2. Busca errores de TypeScript o dependencias faltantes

## Monitoreo

### Métricas Básicas

Render provee:
- CPU usage
- Memory usage
- Response times
- Error rates

Accede desde: Service → Metrics

### Alertas

Configura alertas:
1. Service Settings → "Notifications"
2. Agrega email o webhook

## Costos Estimados

| Componente | Plan | Costo Mensual |
|------------|------|---------------|
| PostgreSQL | Starter | $7 |
| Web Service | Starter | $7 |
| **TOTAL** | | **$14/month** |

**Nota**: Render ofrece planes Free para pruebas, pero tienen limitaciones (servicios duermen después de inactividad).

## Seguridad

### Variables de Entorno Sensibles

- Nunca hagas commit de `.env`
- Usa las Environment Variables de Render
- Rota credenciales regularmente

### HTTPS

Render provee HTTPS automáticamente con certificados Let's Encrypt.

### Database Backups

Render hace backups automáticos diarios en planes Starter y superiores.

## Soporte

- [Render Docs](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Render Status](https://status.render.com)
