# C++ Drogon Backend: Production Deployment Guide

**Application:** Shared Table Ledger (C++17 / Drogon REST API Backend)  
**Binary Target:** `mess_manager_server`  
**Container Base:** Ubuntu 22.04 (Multi-stage build)  
**Framework:** Modern C++17 / Drogon REST Framework  
**Database:** PostgreSQL 14+ (Render Managed PostgreSQL or equivalent)  

---

## 1. Overview & Architecture

The Shared Table Ledger backend is an asynchronous, high-performance C++ REST server built with Drogon, libpq, JsonCpp, and OpenSSL. In production, it is deployed as a Dockerized Web Service on Render (or Railway) that connects to a managed PostgreSQL database and serves API requests to the Vercel-hosted React frontend.

```
┌──────────────────────────────────────────────┐
│       React Frontend (Hosted on Vercel)      │
│       https://shared-table-ledger.vercel.app │
└──────────────────────┬───────────────────────┘
                       │ HTTPS REST (Bearer JWT / CORS)
                       ▼
┌──────────────────────────────────────────────┐
│       C++ Drogon Backend (Docker / Render)   │
│       https://<service-name>.onrender.com    │
└──────────────────────┬───────────────────────┘
                       │ TCP over TLS (sslmode=require)
                       ▼
┌──────────────────────────────────────────────┐
│        PostgreSQL Database (Render / Cloud)  │
│        Tables, Foreign Keys, Auto-Migrations │
└──────────────────────────────────────────────┘
```

---

## 2. Environment Variables Reference

The C++ Drogon server reads all configuration directly from environment variables:

| Variable | Required in Prod | Default | Description |
|---|---|---|---|
| `PORT` | Yes (Render sets automatically) | `8080` | Port assigned dynamically by Render (e.g., 10000 or dynamic) |
| `HOST` | No | `0.0.0.0` | Bind IP address (must remain `0.0.0.0` inside container) |
| `APP_ENV` | Yes | `development` | Set to `production` in live cloud environment |
| `DATABASE_URL` | Yes (Prod) | `""` | Render PostgreSQL URI (`postgres://user:pass@dpg-xxx.oregon-postgres.render.com/dbname?sslmode=require`) |
| `JWT_SECRET` | Yes (Prod) | `""` | Strong 32+ character random secret for signing and verifying tokens |
| `CORS_ALLOWED_ORIGINS` | Yes (Prod) | `https://shared-table-ledger.vercel.app` | Comma-separated list of allowed frontend origins (no trailing slashes) |
| `LOG_LEVEL` | No | `INFO` | Logging verbosity: `INFO`, `WARN`, `DEBUG`, or `ERROR` |
| `SERVER_THREADS` | No | `4` | Worker threads in the Drogon thread pool |
| `DATA_PATH` | No | `/app/data/mess_store.json` | Path for fallback offline data storage in development |

---

## 3. Step-by-Step Render Deployment Guide

### Step 1: Create a PostgreSQL Database on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **PostgreSQL**.
3. Configure the database:
   * **Name:** `mess-manager-db`
   * **Database:** `mess_db`
   * **User:** `postgres`
   * **Region:** Select the region closest to you (e.g. `Singapore` or `Oregon`).
   * **Plan:** `Free`
4. Click **Create Database**.
5. When the database status changes to **Available**, copy the **Internal Database URL** (if deploying backend on Render in the same region) or **External Database URL**.

### Step 2: Create a Web Service for C++ Backend
1. In the Render Dashboard, click **New +** → **Web Service**.
2. Connect your GitHub repository: `mdismail-nub/shared-table-ledger`.
3. Configure the service:
   * **Name:** `shared-table-ledger-api`
   * **Region:** Same region as your database.
   * **Branch:** `main`
   * **Root Directory:** `backend-cpp`
   * **Runtime:** `Docker`
   * **Dockerfile Path:** `Dockerfile` (or `backend-cpp/Dockerfile` depending on context)
   * **Instance Type:** `Free`
4. Under **Environment Variables**, add:
   * `APP_ENV`: `production`
   * `DATABASE_URL`: *(Paste the PostgreSQL connection string from Step 1, ensuring it includes `?sslmode=require`)*
   * `JWT_SECRET`: *(Generate a 32+ character secure secret, e.g. using `openssl rand -base64 32`)*
   * `CORS_ALLOWED_ORIGINS`: `https://shared-table-ledger.vercel.app,http://localhost:3000`
   * `LOG_LEVEL`: `INFO`
5. Click **Create Web Service**.

Render will trigger the multi-stage Docker build, compile Drogon and the backend binary, execute unit tests, and launch the server.

### Step 3: Verify Backend Deployment
Once deployed, copy the service URL (e.g., `https://shared-table-ledger-api.onrender.com`).
Verify the health endpoint using curl or a browser:
```bash
curl https://shared-table-ledger-api.onrender.com/api/health
```
Expected response:
```json
{
  "database": "postgresql_connected",
  "framework": "Modern C++17 / Drogon REST Framework",
  "service": "mess_manager_cpp_backend",
  "status": "healthy",
  "uptime_seconds": 12,
  "version": "1.0.0"
}
```

---

## 4. Connecting Frontend on Vercel to Render Backend

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select your `shared-table-ledger` project.
3. Navigate to **Settings** → **Environment Variables**.
4. Add or update:
   * **Key:** `VITE_CPP_API_URL`
   * **Value:** `https://shared-table-ledger-api.onrender.com` (your Render backend URL, without trailing slash)
   * **Environments:** Production, Preview, Development
5. Go to **Deployments** and click **Redeploy** on the latest deployment so Vite picks up the new environment variable.

---

## 5. Database Schema & Auto-Migrations

On startup in production (`APP_ENV=production`), the C++ server verifies connection to PostgreSQL and automatically runs `backend-cpp/migrations/0001_initial_schema.sql`:

- Creates tables if they do not exist:
  - `messes`
  - `mess_members`
  - `mess_meals`
  - `mess_expenses`
  - `payments`
  - `mess_notifications`
  - `mess_guest_sessions`
  - `mess_users`
- Creates all foreign keys with `ON DELETE CASCADE`
- Creates unique indexes (e.g. `(member_id, date)` on `mess_meals`, `(user_id)` on `mess_members`)
- Creates performance indexes on all query filters

If you wish to manually inspect or execute the schema via `psql`:
```bash
psql "$DATABASE_URL" -f backend-cpp/migrations/0001_initial_schema.sql
```

---

## 6. Troubleshooting

### Issue 1: CORS Policy Error in Browser
- **Symptom:** `Access to fetch at 'https://api...' from origin 'https://...' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present.`
- **Resolution:** Verify that `CORS_ALLOWED_ORIGINS` in your Render Web Service environment variables includes your exact Vercel frontend URL (including `https://` and without trailing slash).

### Issue 2: 401 Unauthorized / Token Expiration
- **Symptom:** API calls return 401.
- **Resolution:** The frontend API client automatically catches 401 responses and redirects to `/auth` to prompt the user to sign in again. Verify that `JWT_SECRET` is consistent across server restarts on Render.

### Issue 3: Mixed Content Error
- **Symptom:** `The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`.
- **Resolution:** In Vercel environment variables, ensure `VITE_CPP_API_URL` starts with `https://`, not `http://`. Render automatically issues free Let's Encrypt SSL certificates for all `*.onrender.com` URLs.
