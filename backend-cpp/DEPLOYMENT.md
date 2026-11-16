# C++ Drogon Backend: Production Deployment Guide

**Application:** Shared Table Ledger (C++17 / Drogon REST API Backend)  
**Binary Target:** `mess_manager_server`  
**Container Base:** Ubuntu 22.04 (Multi-stage build)  
**Framework:** Modern C++17 / Drogon REST Framework  

---

## 1. Overview & Architecture

The Shared Table Ledger backend is an asynchronous, high-performance C++ REST server built with Drogon, JsonCpp, and OpenSSL. In production, it is deployed as a containerized service that connects to a managed PostgreSQL database and serves API requests to the Vercel-hosted React frontend.

```
┌─────────────────────────────────┐
│     React Frontend (Vercel)     │
│  https://*.vercel.app           │
└────────────────┬────────────────┘
                 │ HTTPS REST (CORS enabled)
                 ▼
┌─────────────────────────────────┐
│   C++ Drogon Backend (Docker)   │
│   Render / Railway / Fly.io     │
└────────────────┬────────────────┘
                 │ TCP / SSL (DATABASE_URL)
                 ▼
┌─────────────────────────────────┐
│      PostgreSQL 15+ Database    │
│  Neon / Supabase / Railway      │
└─────────────────────────────────┘
```

---

## 2. Environment Variables Reference

The C++ Drogon server reads all operational configuration directly from environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Yes (Cloud) | `8080` | Port assigned dynamically by host (Render: 10000, Railway: dynamic) |
| `HOST` | No | `0.0.0.0` | Bind IP address (must be `0.0.0.0` inside container) |
| `DATABASE_URL` | Recommended | `""` | PostgreSQL connection string (`postgres://user:pass@host:5432/dbname?sslmode=require`) |
| `POSTGRES_URL` | Alternative | `""` | Alternative PostgreSQL connection string |
| `JWT_SECRET` | Yes (Prod) | Internal key | Strong secret key (min 32 chars) for signing authentication JWT tokens |
| `CORS_ORIGIN` | Recommended | `*` | Allowed frontend origin (e.g., `https://your-mess.vercel.app`) |
| `DATA_PATH` | No | `/app/data/mess_store.json` | Path to persistent volume for offline fallback and local cache |
| `SERVER_THREADS` | No | `4` | Number of worker threads for the Drogon thread pool |

---

## 3. Deployment Option A: Render (Recommended, Free Tier Available)

Render supports native Docker deployment directly from your GitHub repository.

### Step 1: Push Repository to GitHub
Ensure the latest code containing `backend-cpp/Dockerfile` is pushed to your GitHub repository.

### Step 2: Create a PostgreSQL Database on Render
1. Go to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **PostgreSQL**.
3. Name: `mess-ledger-db`.
4. Region: Choose closest to your users (e.g., `Singapore` or `Frankfurt`).
5. Click **Create Database**.
6. Once provisioned, copy the **Internal Database URL** (or External URL).

### Step 3: Create a Web Service
1. Click **New +** → **Web Service**.
2. Connect your GitHub repository: `mdismail-nub/shared-table-ledger`.
3. In service settings:
   * **Name:** `mess-manager-backend`
   * **Language:** `Docker`
   * **Root Directory:** `backend-cpp`
   * **Dockerfile Path:** `Dockerfile` (relative to `backend-cpp`)
   * **Instance Type:** `Free`
4. Add **Environment Variables**:
   * `PORT`: `10000` (Render's default)
   * `DATABASE_URL`: *(Paste your Render PostgreSQL connection string)*
   * `JWT_SECRET`: *(Generate a strong 32+ character random string)*
   * `CORS_ORIGIN`: `*` (or your specific Vercel URL, e.g. `https://shared-table-ledger.vercel.app`)
5. Click **Deploy Web Service**.

### Step 4: Verify Deployment
Once the build completes, Render will provide a public URL like:
`https://mess-manager-backend.onrender.com`

Verify using curl or a browser:
```bash
curl https://mess-manager-backend.onrender.com/api/health
```
Expected response:
```json
{
  "status": "healthy",
  "service": "mess_manager_cpp_backend",
  "framework": "Modern C++17 / Drogon REST Framework",
  "version": "1.0.0",
  "uptime_seconds": 15,
  "database": "postgresql_connected"
}
```

---

## 4. Deployment Option B: Railway

Railway automatically detects Dockerfiles and provisions instant PostgreSQL databases.

### Step 1: Create a Railway Project
1. Go to [Railway Dashboard](https://railway.app).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select `mdismail-nub/shared-table-ledger`.
4. In **Settings** → **Build**:
   * Set **Root Directory** to `/backend-cpp`.
   * Set **Dockerfile Path** to `Dockerfile`.

### Step 2: Add PostgreSQL
1. Inside the project canvas, click **+ New** → **Database** → **Add PostgreSQL**.
2. Click on the PostgreSQL service → **Variables** → Copy `DATABASE_URL`.

### Step 3: Configure Backend Variables
In your C++ backend service settings, add:
* `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (Railway reference)
* `JWT_SECRET`: `super_secret_jwt_key_at_least_32_characters_long`
* `CORS_ORIGIN`: `*`

### Step 4: Generate Domain
In backend service **Settings** → **Networking** → Click **Generate Domain**.
You will receive a public HTTPS URL (e.g. `https://mess-backend-production.up.railway.app`).

---

## 5. Deployment Option C: Self-Hosted Docker / VPS

For deploying on an Ubuntu VPS (DigitalOcean, AWS EC2, Linode):

```bash
# 1. Clone repository
git clone https://github.com/mdismail-nub/shared-table-ledger.git
cd shared-table-ledger/backend-cpp

# 2. Build Docker container
docker build -t mess-manager-backend:latest .

# 3. Run container
docker run -d \
  --name mess_backend \
  --restart unless-stopped \
  -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL="postgresql://user:password@db-host:5432/mess_db?sslmode=require" \
  -e JWT_SECRET="your_secure_random_jwt_secret_32_chars" \
  -e CORS_ORIGIN="https://shared-table-ledger.vercel.app" \
  -v /var/data/mess:/app/data \
  mess-manager-backend:latest

# 4. Check status
curl http://localhost:8080/api/health
```

---

## 6. Troubleshooting Production Issues

### Issue 1: Health check timeout on Render / Railway
* **Cause:** The server did not bind to the port expected by the platform.
* **Fix:** The server now automatically inspects `PORT` and `APP_PORT`. Ensure the port in Render matches `PORT` (e.g., 10000).

### Issue 2: CORS errors in browser console
* **Error:** `No 'Access-Control-Allow-Origin' header is present on the requested resource.`
* **Fix:** The C++ Drogon server now reflects the incoming `Origin` header dynamically and supports `Access-Control-Allow-Credentials: true` across all endpoints and preflight requests. Set `CORS_ORIGIN` to your Vercel URL or `*`.

### Issue 3: Mixed Content (`https://` calling `http://`)
* **Error:** `The page at 'https://...' was loaded over HTTPS, but requested an insecure endpoint 'http://...'`.
* **Fix:** You MUST configure the frontend's `VITE_CPP_API_URL` with an **`https://`** URL. Render, Railway, and Fly.io provide free automatic SSL certificates for all deployed apps.
