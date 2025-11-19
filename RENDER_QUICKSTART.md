# Render Deployment Quick Start Guide

## Automatic Option (Blueprint)

### 1. Preparation
- Ensure your code is pushed to GitHub/GitLab
- Create an account on render.com

### 2. Create Blueprint
1. Render Dashboard → "New +" → "Blueprint"
2. Connect your repository
3. Select the "kira" repo
4. Render will automatically detect `render.yaml`
5. Click "Apply"

### 3. Wait for deployment
- PostgreSQL database will be created first (~3 min)
- Then the API service (~5-7 min)
- Both must show "Live" status (green circle)

### 4. Get the URL
- Go to the "kira-payment-api" service
- Copy the URL (e.g., https://kira-payment-api.onrender.com)

### 5. Update BASE_URL variable
1. In the "kira-payment-api" service
2. Go to "Environment"
3. Edit `BASE_URL` with your actual URL
4. Save changes (this will restart the service)

### 6. Verify
```bash
curl https://YOUR-URL.onrender.com/health
```

### 7. Run seed (optional)
1. Service → "Shell"
2. Run: `npm run prisma:seed`

---

## Manual Option

### 1. Create PostgreSQL Database
1. Dashboard → "New +" → "PostgreSQL"
2. Configure:
   - Name: `kira-payment-db`
   - Database: `kira_payments`
   - Region: Oregon
   - Plan: Starter ($7/mo) or Free
3. "Create Database"
4. Copy "Internal Database URL"

### 2. Create Web Service
1. Dashboard → "New +" → "Web Service"
2. Connect repository
3. Configure:
   - Name: `kira-payment-api`
   - Region: Oregon (same as DB)
   - Runtime: Node
   - Build Command:
     ```
     npm install && npx prisma generate && npm run build
     ```
   - Start Command:
     ```
     npx prisma migrate deploy && npm start
     ```

### 3. Add Environment Variables

In the Web Service "Environment", add:

```
NODE_ENV=production
PORT=10000
DATABASE_URL=[paste Internal Database URL here]
CORS_ORIGIN=*
BASE_URL=https://your-service.onrender.com
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
2. Wait until it's "Live"

---

## Testing Post-Deployment

### 1. Health Check
```bash
curl https://your-url.onrender.com/health
```

### 2. Create Payment Link
```bash
curl -X POST https://your-url.onrender.com/payment-links \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_123",
    "amountUsd": 100.0,
    "description": "Test payment"
  }'
```

### 3. Get Payment Link
```bash
curl https://your-url.onrender.com/payment-links/[LINK-ID]
```

---

## Troubleshooting

### Error: "Database connection failed"
- Verify that you use the **Internal Database URL** (not External)
- Make sure DB and API are in the same region

### Error: "Cannot find module '@prisma/client'"
- Verify that the Build Command includes `npx prisma generate`
- Manual redeploy from dashboard

### Service won't start
1. Go to "Logs" in the dashboard
2. Look for specific errors
3. Verify that all env vars are configured

### Migrations fail
1. Go to "Shell"
2. Run: `npx prisma migrate deploy`

---

## Costs

- PostgreSQL Starter: $7/month
- Web Service Starter: $7/month
- **Total: $14/month**

Free plan available for testing (limitations: sleep after inactivity)

---

## Next steps

1. Configure auto-deploy on your main branch
2. Add custom domain (optional)
3. Configure monitoring alerts
4. Implement Angular frontend
