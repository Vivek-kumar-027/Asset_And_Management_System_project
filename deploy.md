# Deployment Guide — AI-Powered Asset & Maintenance Ops Dashboard

This guide provides step-by-step instructions to deploy the entire full-stack application to production.

---

##  Production Architecture

```
[User Browser]
       │
       ▼
[React Frontend] (Render Static Site or Vercel)
       │
       ▼ HTTPS REST / JWT
[Node.js Express Backend API] (Render Web Service)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼ HTTP Internal / Private
[MongoDB Atlas Cloud DB]        [Python AI Analysis Service]
(Encrypted Storage)             (FastAPI Rules Engine)
```

---

##  Prerequisites

1. **GitHub Account**: A repository containing this project's code.
2. **MongoDB Atlas Account**: [cloud.mongodb.com](https://www.mongodb.com/cloud/atlas) (Free M0 cluster).
3. **Render Account**: [render.com](https://render.com) (Spec recommended hosting platform).
4. *(Optional)* **Vercel Account**: [vercel.com](https://vercel.com) (If you prefer hosting the React frontend on Vercel's Edge CDN).

---

##  Step 1: Set Up MongoDB Atlas (Database)

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Click **Create a Deployment** $\rightarrow$ select **M0 (Free)** cluster $\rightarrow$ choose your nearest region.
3. Under **Security Quickstart**:
   - **Database User**: Create a user (e.g., `opsadmin`) and set a strong password. Note these down.
   - **Network Access**: Add IP Address `0.0.0.0/0` (Allow Access from Anywhere) so cloud services on Render can connect.
4. Go to **Clusters** $\rightarrow$ Click **Connect** $\rightarrow$ Choose **Drivers (Node.js)**.
5. Copy the connection string. It looks like:
   ```
   mongodb+srv://opsadmin:<password>@cluster0.abcde.mongodb.net/asset_ops_dashboard?retryWrites=true&w=majority
   ```
   *(Replace `<password>` with your actual database password).*

---

##  Option A: Automated 1-Click Deployment (Render Blueprint)

This repository includes a [`render.yaml`](file:///e:/NxtWave/Asset%20&%20Maintenance%20Ops/render.yaml) Blueprint that automatically provisions and wires all three services together.

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete asset ops dashboard with render blueprint"
   git push origin main
   ```
2. Log in to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** in the top right $\rightarrow$ Select **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect the three services defined in `render.yaml`:
   - `asset-ops-ai-service` (Python FastAPI)
   - `asset-ops-backend` (Node.js Express API)
   - `asset-ops-frontend` (React Static Site)
6. Enter your `MONGO_URI` connection string from Step 1 when prompted.
7. Click **Apply**. Render will build and deploy all services simultaneously.

---

##  Option B: Manual Step-by-Step Deployment (Render)

If you prefer to configure services individually on Render, follow these steps in order:

### 1. Deploy the Python AI Analysis Microservice

1. On the Render dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `asset-ops-ai-service`
   - **Region**: Same region as your database (e.g., Oregon / Frankfurt)
   - **Root Directory**: `ai-service`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/health`
5. Click **Create Web Service**.
6. Once deployed, copy the service URL (e.g. `https://asset-ops-ai-service.onrender.com`).

---

### 2. Deploy the Node.js Express API Backend

1. On the Render dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `asset-ops-backend`
   - **Region**: Same region as the AI service
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Expand **Advanced** $\rightarrow$ **Health Check Path**: `/api/health`.
5. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizations |
   | `PORT` | `5000` | Render injects this automatically, but specify 5000 |
   | `MONGO_URI` | `mongodb+srv://...` | Connection string from Step 1 |
   | `JWT_SECRET` | *(Generate a random 32+ char string)* | Used to sign JWTs |
   | `PYTHON_SERVICE_URL` | `https://asset-ops-ai-service.onrender.com` | Deployed URL from Python service |
   | `CLIENT_ORIGIN` | `*` *(or your frontend URL)* | CORS origin |
6. Click **Create Web Service**.
7. Once deployed, copy the backend URL (e.g. `https://asset-ops-backend.onrender.com`).

---

### 3. Deploy the React Frontend

You can deploy the frontend on either **Render Static Sites** or **Vercel**:

#### Method 1: Render Static Site
1. Click **New +** $\rightarrow$ **Static Site**.
2. Connect your GitHub repository.
3. Configure:
   - **Name**: `asset-ops-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL`: `https://asset-ops-backend.onrender.com/api`
5. Under **Redirects/Rewrites**:
   - Add a rewrite: Source `/*` $\rightarrow$ Destination `/index.html` (Status: 200 Rewrite).
6. Click **Create Static Site**.

#### Method 2: Vercel (Alternative for ultra-fast CDN)
1. Log in to [vercel.com](https://vercel.com) $\rightarrow$ Click **Add New Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**:
   - `VITE_API_URL`: `https://asset-ops-backend.onrender.com/api`
5. Click **Deploy**. *(The project already includes [`frontend/vercel.json`](file:///e:/NxtWave/Asset%20&%20Maintenance%20Ops/frontend/vercel.json) for client-side SPA routing).*

---

## ❄️ Free-Tier Cold-Start Behavior & Uptime Mitigation

Per `spec.md` Section 5:
> *"The application is deployed and reachable at a public URL, with cold-start behavior documented if using a free hosting tier."*

### Why Cold Starts Happen
On Render's Free tier, services automatically spin down after **15 minutes of inactivity**. The first request after a spin-down triggers a "cold start", taking **~40 to 60 seconds** to boot the container before responding. Subsequent requests respond instantly.

### How to Keep Services Warm (Zero Cold Starts)
You can prevent services from spinning down using a free external uptime monitor:
1. Create a free account on [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
2. Create two HTTP monitor checks configured to run every **10 minutes**:
   - **Backend API Ping**: `GET https://your-backend.onrender.com/api/health`
   - **AI Microservice Ping**: `GET https://your-ai-service.onrender.com/health`
3. This periodic ping keeps both containers warm 24/7 without exceeding free tier limits.

---

## 🌱 Post-Deployment Verification & Seeding

Once deployed, initialize the production database with demo assets and personas:

### 1. Seed Demo Data
You can seed the database in two ways:
- **Via Frontend UI**:
  1. Open your deployed frontend URL.
  2. Log in using the default Admin persona:
     - **Email**: `admin@ops.local`
     - **Password**: `Admin@12345`
  3. Click **"Seed Demo Data"** in the top navigation bar.
- **Via cURL / Terminal**:
  ```bash
  curl -X POST https://your-backend.onrender.com/api/assets/seed
  ```

### 2. Verify Key Workflows
1. **Asset Monitoring**: Confirm assets load with their health badges (`Healthy`, `Watch`, `Critical`).
2. **AI Analysis & Telemetry**: Click an asset (e.g. *Generator 3*) to view its Recharts telemetry graph and explainable AI recommendation.
3. **Ingest Sensor Reading**: In the asset modal, click **"Ingest Reading"** $\rightarrow$ enter high temperature (>85°C) $\rightarrow$ confirm instant re-classification to `Critical` and alert creation.
4. **Alert Routing**: Switch to the **Alerts Queue** $\rightarrow$ test acknowledging and resolving an incident with a mandatory `resolutionNote`.
5. **RBAC**: Log out and log in as `electrical@ops.local` (`Staff@12345`) $\rightarrow$ verify you can only view Electrical department assets and alerts (cross-department actions return 403).

---

## 🔒 Production Environment Variables Summary

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/asset_ops_dashboard?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars
PYTHON_SERVICE_URL=https://your-ai-service.onrender.com
CLIENT_ORIGIN=https://your-frontend.onrender.com
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://your-backend.onrender.com/api
```
