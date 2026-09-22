# Deployment Guide — AI-Powered Asset & Maintenance Ops Dashboard

This guide provides end-to-end production deployment instructions for the entire multi-tier stack, based on a comprehensive architectural analysis of the project.

---

## Production Architecture

The system comprises three independent operational layers backed by a cloud database:

```
[End-User Browser]
       │
       ▼ (HTTPS)
┌─────────────────────────────────────────────────────────────┐
│ 1. FRONTEND TIER (React 18 + Vite 6 + Tailwind CSS)         │
│ • Hosting: Render Static Site or Vercel Edge                │
│ • Builds to static assets in `dist/`                        │
│ • Connects to API via `VITE_API_URL`                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (HTTPS / Bearer JWT)
┌─────────────────────────────────────────────────────────────┐
│ 2. BACKEND API TIER (Node.js + Express 4)                   │
│ • Hosting: Render Web Service                               │
│ • Port: Dynamically assigned via `$PORT` (default 5000)     │
│ • Handles Authentication, Asset CRUD, Telemetry Ingestion   │
│ • Health Check: `/api/health`                               │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
(Mongoose / TLS)                              │ (Internal HTTP POST /analyze)
               ▼                              ▼
┌──────────────────────────────┐┌─────────────────────────────┐
│ 4. DATABASE TIER             ││ 3. AI MICROSERVICE TIER     │
│ • MongoDB Atlas (Cloud M0)   ││ • Python 3 + FastAPI        │
│ • Encrypted Cloud Storage    ││ • Hosting: Render Web Service│
│ • Collections: assets, users,││ • Evaluates Rules 1 to 4    │
│   readings, alerts, logs     ││ • Health Check: `/health`   │
└──────────────────────────────┘└─────────────────────────────┘
```

---

## Technical Stack & Component Analysis

| Component | Directory | Runtime / Framework | Build Command | Start Command | Health Check |
|---|---|---|---|---|---|
| **AI Service** | `ai-service/` | Python 3.13, FastAPI, Uvicorn | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0 --port $PORT` | `/health` |
| **Backend API** | `backend/` | Node.js v22, Express, Mongoose | `npm install` | `npm start` | `/api/health` |
| **Frontend** | `frontend/` | React 18, Vite 6, Tailwind CSS | `npm install && npm run build` | Static host (`dist/`) | Client SPA |
| **Database** | Cloud | MongoDB Atlas (Cluster M0) | N/A | Managed Cloud Service | Cloud Console |

---

## Prerequisites

Before starting, ensure you have:
1. **GitHub Account**: A repository containing your project code.
2. **MongoDB Atlas Account**: [cloud.mongodb.com](https://www.mongodb.com/cloud/atlas) (Free M0 tier).
3. **Render Account**: [render.com](https://render.com) (Primary host recommended in project spec).
4. *(Optional)* **Vercel Account**: [vercel.com](https://vercel.com) (If deploying the React frontend to Vercel).

---

## Phase 1: MongoDB Atlas Cloud Setup

### 1. Create Cluster & Database
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Click **Create a Deployment** $\rightarrow$ Select **M0 (Free)** $\rightarrow$ Choose your preferred cloud region.
3. Name your cluster (e.g. `CollegeManegementDatabase` or `AssetOpsCluster`).

### 2. Configure Database Security
1. Under **Database Access**:
   - Add a new database user (e.g. `campus_database_admin`).
   - Choose **Password** authentication and save the password securely.
   - Assign user role: **Read and write to any database**.
2. Under **Network Access**:
   - Click **Add IP Address**.
   - Select **Allow Access from Anywhere (`0.0.0.0/0`)**.
   - *Note: This is mandatory so cloud hosting containers on Render/Vercel with dynamic IPs can connect.*

### 3. Get Your Connection String
1. Go to **Clusters** $\rightarrow$ Click **Connect** $\rightarrow$ Choose **Drivers (Node.js)**.
2. Copy the connection URI. It follows this structure:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/asset_mangement_db?retryWrites=true&w=majority
   ```
3. Replace `<username>` and `<password>` with your database credentials.

### 4. Verify Connection Locally (Optional but Recommended)
Test your connection string before cloud deployment by running:
```bash
cd backend
node src/tests/check_db.js "mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/asset_mangement_db?retryWrites=true&w=majority"
```
Output confirming success:
```
✅ MongoDB connection: OK
Database Name: asset_mangement_db
Status: MongoDB setup is completely healthy and operational.
```

---

## Phase 2: Deploy Python AI Analysis Microservice

The AI microservice evaluates equipment telemetry against Rules 1–4 and generates plain-language recommendations. Deploy this service first so its public URL is ready for the backend.

1. In the [Render Dashboard](https://dashboard.render.com), click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `asset-ops-ai-service`
   - **Region**: Choose the region closest to your MongoDB Atlas cluster (e.g. Oregon / Frankfurt)
   - **Root Directory**: `ai-service`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`
5. Click **Create Web Service**.
6. When deployment finishes, copy your public service URL:
   ```
   https://asset-ops-ai-service.onrender.com
   ```
   *(Verify by opening `https://asset-ops-ai-service.onrender.com/health` in your browser. It should return `{"status": "healthy", "service": "Asset AI Analysis Service"}`).*

---

## Phase 3: Deploy Node.js Express API Backend

The backend manages data persistence, JWT authentication, department RBAC, and invokes the Python AI service.

1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `asset-ops-backend`
   - **Region**: Same region as your AI service
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/api/health`
   - **Auto-Deploy**: `Yes`
5. Under **Environment Variables**, add the following keys:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `5000` | Port where Express listens |
| `MONGO_URI` | `mongodb+srv://...` | Connection string from Phase 1 |
| `JWT_SECRET` | *(Generate a 32+ char random string)* | Used to sign and verify JWT tokens |
| `PYTHON_SERVICE_URL` | `https://asset-ops-ai-service.onrender.com` | Deployed URL from Phase 2 |
| `CLIENT_ORIGIN` | `*` *(or your frontend URL)* | CORS permitted origin |

6. Click **Create Web Service**.
7. Once deployment finishes, copy your backend URL:
   ```
   https://asset-ops-backend.onrender.com
   ```
   *(Verify by visiting `https://asset-ops-backend.onrender.com/api/health`. It should return `{"status": "ok", "service": "Asset & Maintenance Ops API"}`).*

---

## Phase 4: Deploy React Frontend

You can deploy the frontend on either **Render Static Sites** or **Vercel**. Both methods are fully supported.

### Option 1: Render Static Site (Unified Hosting)
1. In Render Dashboard, click **New +** $\rightarrow$ **Static Site**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name**: `asset-ops-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Under **Environment Variables**:
   - `VITE_API_URL`: `https://asset-ops-backend.onrender.com/api`
5. Under **Redirects/Rewrites**:
   - Click **Add Rule**
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - *Note: This ensures client-side routing works on page refreshes without 404 errors.*
6. Click **Create Static Site**.

### Option 2: Vercel (Edge CDN Deployment)
1. Log in to [vercel.com](https://vercel.com) $\rightarrow$ Click **Add New Project**.
2. Select and import your GitHub repository.
3. In project setup:
   - **Root Directory**: Click edit and choose `frontend`.
   - **Build Command**: `npm run build` (auto-detected).
   - **Output Directory**: `dist` (auto-detected).
4. Under **Environment Variables**:
   - Add `VITE_API_URL` with value `https://asset-ops-backend.onrender.com/api`
5. Click **Deploy**.
   *(SPA routing is handled automatically by [`frontend/vercel.json`](file:///e:/NxtWave/Asset%20&%20Maintenance%20Ops/frontend/vercel.json)).*

---

## Alternative: 1-Click Deployment with Render Blueprint

If you prefer deploying the whole system in a single step using Infrastructure as Code (IaC), use the included [`render.yaml`](file:///e:/NxtWave/Asset%20&%20Maintenance%20Ops/render.yaml) file:

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "feat: configure production deployment"
   git push origin main
   ```
2. In Render, go to **Blueprints** $\rightarrow$ Click **New Blueprint Instance**.
3. Connect your repository.
4. Render will read `render.yaml` and configure:
   - `asset-ops-ai-service`
   - `asset-ops-backend` (with linked internal URL)
   - `asset-ops-frontend` (with linked API URL and SPA rewrites)
5. Enter your `MONGO_URI` when prompted $\rightarrow$ Click **Apply**.

---

## Free-Tier Cold-Start Behavior & Uptime Monitoring

Per project specification (`spec.md` Section 5):
> *"The application is deployed and reachable at a public URL, with cold-start behavior documented if using a free hosting tier."*

### Why Cold Starts Occur
Render Free web services spin down to zero containers after **15 minutes of inactivity**. When a new request arrives, Render spins up the container, taking **40 to 60 seconds** to respond ("cold start"). After waking up, subsequent requests respond in milliseconds.

### Free 24/7 Keep-Warm Mitigation
To prevent services from ever sleeping (0-second response times 24/7):
1. Sign up for a free monitor on [uptimerobot.com](https://uptimerobot.com) or [cron-job.org](https://cron-job.org).
2. Set up two HTTP `GET` monitors scheduled every **10 minutes**:
   - **Backend Monitor**: `https://your-backend.onrender.com/api/health`
   - **AI Service Monitor**: `https://your-ai-service.onrender.com/health`
3. Because the ping intervals are under 15 minutes, Render will never spin down your containers.

---

## Post-Deployment Data Seeding

After deploying, your production database needs initial equipment and user personas.

### How to Seed Production Data:

#### Method A: From the Deployed Frontend (Easiest)
1. Open your deployed frontend URL in your browser.
2. Sign in with the default seeded Admin persona:
   - **Email**: `admin@ops.local`
   - **Password**: `Admin@12345`
3. Click the **"Seed Demo Data"** button in the top navigation bar.

#### Method B: Via CLI Before or After Deploy
Run this command from your local terminal with your production `MONGO_URI`:
```bash
cd backend
npm run seed
```

#### Method C: Via cURL / API
```bash
curl -X POST https://your-backend.onrender.com/api/assets/seed
```

This creates:
- **4 Personas**: Admin, Electrical Staff, HVAC Staff, Plumbing Staff.
- **7 Assets**: Spread across Electrical, HVAC, Plumbing, IT, and General.
- **252 Telemetry Records**: 35+ days of historical runtime hours, temperatures, and error codes.
- **Active Incidents**: Automatically routed to department queues with AI summaries.

---

## Production Verification Runbook

Follow this checklist to verify your live deployment:

1. **AI Service Health**:
   - Open `https://your-ai-service.onrender.com/health`
   - Expected: `{"status": "healthy", "service": "Asset AI Analysis Service"}`
2. **Backend API Health**:
   - Open `https://your-backend.onrender.com/api/health`
   - Expected: `{"status": "ok", "service": "Asset & Maintenance Ops API"}`
3. **Frontend Application**:
   - Open your deployed frontend URL.
   - Confirm the dark-mode login page renders cleanly.
   - Use the demo persona cards to sign in as **Admin**.
4. **Operations Dashboard**:
   - Confirm overview metrics render: Total Assets, Healthy, Watch, Critical, Active Alerts.
   - Confirm equipment cards display location, interval, and maintenance countdowns.
   - Test filtering by department, equipment type, and status without full page reload.
5. **AI Telemetry & Explainability**:
   - Click an asset card (e.g. *Primary Chiller 1* or *Generator 3*).
   - Confirm the Recharts time-series graph plots temperature with the safety threshold line.
   - Click **"Ingest Reading"** $\rightarrow$ submit a reading $\rightarrow$ verify that the AI decision layer runs immediately and updates the cached status.
6. **Incident Queue & Audit Trail**:
   - Navigate to the **Alerts Queue** tab.
   - Acknowledge an alert $\rightarrow$ verify status chip updates.
   - Click **Resolve Alert** $\rightarrow$ enter a `resolutionNote` $\rightarrow$ confirm it moves to Resolution History and commits an entry to the audit trail.
7. **Role-Based Access Control (RBAC)**:
   - Log out and log in as `electrical@ops.local` (`Staff@12345`).
   - Confirm you only see assets and alerts in the **Electrical** department.
   - Confirm Admin buttons ("Register Asset", "Deactivate") are hidden.

---

## Troubleshooting & Common Pitfalls

| Issue | Root Cause | Solution |
|---|---|---|
| **Backend fails with `MongooseServerSelectionError`** | MongoDB Atlas IP access not configured for cloud containers | In MongoDB Atlas, go to **Network Access** $\rightarrow$ add `0.0.0.0/0` (Allow from Anywhere). |
| **CORS error in browser console** | Backend rejecting requests from frontend domain | Set `CLIENT_ORIGIN=*` in the backend Render environment variables, or specify your exact frontend URL (e.g. `https://your-frontend.onrender.com`). |
| **Frontend shows 404 on page refresh** | Static host routing missing SPA rewrite rule | On Render Static Site, add Rewrite rule: `/*` $\rightarrow$ `/index.html`. On Vercel, ensure [`frontend/vercel.json`](file:///e:/NxtWave/Asset%20&%20Maintenance%20Ops/frontend/vercel.json) is present. |
| **AI Analysis fails or times out** | Backend cannot reach Python microservice | Verify `PYTHON_SERVICE_URL` in backend environment variables matches the exact deployed URL of the Python service (e.g. `https://asset-ops-ai-service.onrender.com`). |
| **Login fails with 401 on fresh deployment** | Database has not been seeded yet | Run `npm run seed` or trigger `POST /api/assets/seed` to provision the default personas. |
