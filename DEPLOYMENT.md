# Deployment Guide on Render

## Prerequisites

1. Account on [Render.com](https://render.com)
2. Git repository (GitHub, GitLab or Bitbucket)
3. Code pushed to repository

## Option 1: Automatic Deployment with Blueprint

### Step 1: Connect Repository

1. Access [Render Dashboard](https://dashboard.render.com)
2. Click on "New +" → "Blueprint"
3. Connect your Git repository
4. Render will automatically detect the `render.yaml` file

### Step 2: Configure Environment Variables

Render will automatically create:
- A PostgreSQL service (`kira-payment-db`)
- A web service (`kira-payment-api`)

Environment variables are already defined in `render.yaml`, but verify:

- `DATABASE_URL`: Will automatically connect to the DB
- `BASE_URL`: Update with your Render URL (e.g. `https://kira-payment-api.onrender.com`)

### Step 3: Deploy

1. Click on "Apply"
2. Render will start the build and deployment
3. Wait for both services to be "Live" (green circle)

### Step 4: Run Migrations and Seed

Migrations run automatically in the start command.

To run seed manually:

```bash
# From Render dashboard, go to Shell and run:
npm run prisma:seed
```

## Option 2: Manual Deployment

### Step 1: Create PostgreSQL Database

1. Dashboard → "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `kira-payment-db`
   - **Database**: `kira_payments`
   - **User**: `postgres` (default)
   - **Region**: Oregon (or your preference)
   - **Plan**: Starter ($7/month) or Free ($0/month for testing)
3. Click "Create Database"
4. Wait for it to be "Available"
5. Copy the **Internal Database URL** (we'll use it later)

### Step 2: Create Web Service

1. Dashboard → "New +" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name**: `kira-payment-api`
   - **Region**: Oregon (same as DB)
   - **Branch**: `main` (or your main branch)
   - **Runtime**: Node
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npx prisma migrate deploy && npm start
     ```
   - **Plan**: Starter ($7/month) or Free ($0/month)

### Step 3: Configure Environment Variables

In the "Environment" section, add:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=<paste-internal-database-url-here>
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

**Important**: Replace `https://kira-payment-api.onrender.com` with the actual URL that Render assigns you.

### Step 4: Deploy

1. Click "Create Web Service"
2. Render will start the build automatically
3. Monitor logs in the "Logs" tab
4. Wait for the service to be "Live"

### Step 5: Verify Deployment

Access your URL and verify the healthcheck:

```bash
curl https://your-app.onrender.com/health
```

You should receive:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T...",
  "database": "connected"
}
```

### Step 6: Seed Data (Optional)

1. Go to your service in Render Dashboard
2. Click on "Shell" (top tab)
3. Run:
   ```bash
   npm run prisma:seed
   ```

## Additional Configuration

### Health Check

Render will automatically check the `/health` route every 30 seconds.

### Auto-Deploy

By default, Render will automatically redeploy when you push to the configured branch.

To disable:
1. Service Settings → "Auto-Deploy"
2. Toggle OFF

### Logs

To view logs in real-time:
```bash
# From your local terminal
curl https://api.render.com/v1/services/<service-id>/logs
```

Or from the dashboard: Service → Logs

### Scaling

To increase resources:
1. Service Settings → "Instance Type"
2. Select a higher plan
3. Save Changes

## Troubleshooting

### Error: "Cannot find module '@prisma/client'"

Solution:
1. Verify that the Build Command includes `npx prisma generate`
2. Manual redeploy from dashboard

### Error: "Database connection failed"

Solution:
1. Verify that `DATABASE_URL` is configured correctly
2. Make sure to use the **Internal Database URL** (not External)
3. Verify that DB and service are in the same region

### Error: "Migrations failed"

Solution:
1. Go to Shell in the service
2. Run manually:
   ```bash
   npx prisma migrate deploy
   ```

### Service won't start

Check the logs:
1. Service → Logs
2. Look for TypeScript errors or missing dependencies

## Monitoring

### Basic Metrics

Render provides:
- CPU usage
- Memory usage
- Response times
- Error rates

Access from: Service → Metrics

### Alerts

Configure alerts:
1. Service Settings → "Notifications"
2. Add email or webhook

## Estimated Costs

| Component | Plan | Monthly Cost |
|-----------|------|--------------|
| PostgreSQL | Starter | $7 |
| Web Service | Starter | $7 |
| **TOTAL** | | **$14/month** |

**Note**: Render offers Free plans for testing, but they have limitations (services sleep after inactivity).

## Security

### Sensitive Environment Variables

- Never commit `.env`
- Use Render's Environment Variables
- Rotate credentials regularly

### HTTPS

Render provides HTTPS automatically with Let's Encrypt certificates.

### Database Backups

Render makes automatic daily backups on Starter plans and above.

## Support

- [Render Docs](https://render.com/docs)
- [Render Community](https://community.render.com)
- [Render Status](https://status.render.com)
