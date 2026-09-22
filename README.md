# AI-Powered Asset & Maintenance Ops Dashboard

An enterprise-grade facility governance and operations dashboard that monitors physical assets (Generators, HVAC units, Lifts, Water Pumps), ingests periodic telemetry readings, and runs an explainable, rule-based Python AI decision layer to produce actionable health assessments (`Healthy` / `Watch` / `Critical`) and plain-language recommendations.

Flagged assets automatically route to department-specific queues (`Electrical`, `HVAC`, `Plumbing`, `IT`, `General`), maintaining a full audit trail of maintenance actions, AI flags, and incident resolutions.

---

## 🏗️ Architecture

```
                                  +------------------------------------+
                                  |      React + Vite + Tailwind       |
                                  |      Frontend (Port 3000)          |
                                  +-----------------+------------------+
                                                    |
                                        (JWT / REST / Vite Proxy)
                                                    v
                                  +------------------------------------+
                                  |      Node.js + Express REST API    |
                                  |      Backend (Port 5000)           |
                                  +--------+------------------+--------+
                                           |                  |
                        (Mongoose Schemas) |                  | (HTTP POST /analyze)
                                           v                  v
                         +--------------------+    +-------------------+
                         |   MongoDB Atlas /  |    |   Python FastAPI  |
                         |   Local Database   |    |   Rules Engine    |
                         |   (Port 27017)     |    |   (Port 8000)     |
                         +--------------------+    +-------------------+
```

---

## ⚡ Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts, Lucide Icons | Responsive operations dashboard with dark mode & telemetry visualization |
| **Backend API** | Node.js, Express.js | REST API handling auth, asset CRUD, ingestion, and audit trails |
| **AI Analysis Service** | Python 3 (FastAPI, Uvicorn, Pydantic) | Explainable rule-based decision engine implementing Rules 1–4 |
| **Database** | MongoDB (Atlas / Local) via Mongoose | Schemas for Assets, Readings, MaintenanceLogs, Users, and Alerts |
| **Authentication** | JWT (JSON Web Tokens) & bcrypt.js | Secure password hashing (10 salt rounds) and server-side RBAC |

---

## 🧠 AI Decision Layer (Explainable Rules)

Health status is evaluated across 4 independent checks, resolving to the **highest severity** (`Critical` > `Watch` > `Healthy`):

1. **Rule 1 — Runtime Deviation**:
   - Compares the asset's trailing 7-day average daily runtime against its trailing 30-day baseline average.
   - **>25% above baseline** $\rightarrow$ `Watch`, reason: `runtime_deviation`
   - **>50% above baseline** $\rightarrow$ `Critical`, reason: `runtime_deviation_severe`

2. **Rule 2 — Recent Error Code**:
   - Scans readings in the trailing **48 hours** for any non-null, non-empty error code.
   - **Active error detected** $\rightarrow$ `Critical`, reason: `recent_error`

3. **Rule 3 — Maintenance Overdue**:
   - Compares `today - lastServicedDate` to `maintenanceIntervalDays`.
   - **Overdue by $>1.0\times$ interval** $\rightarrow$ `Watch`, reason: `maintenance_overdue`
   - **Overdue by $>1.5\times$ interval** $\rightarrow$ `Critical`, reason: `maintenance_severely_overdue`

4. **Rule 4 — Temperature Threshold**:
   - Evaluates temperature readings against default safety limits per equipment type:
     - **HVAC**: 50.0°C
     - **Generator**: 85.0°C
     - **Pump**: 65.0°C
     - **Lift / Other**: 50.0°C / 60.0°C
   - **Threshold exceeded** $\rightarrow$ `Critical`, reason: `temperature_exceeded`

### Plain-Language Summary Generation
Instead of an opaque score, the AI generates explainable recommendations combining triggered reasons:
> *"Generator 3 (East Wing) flagged as Critical: error code 'ERR_VOLT_UNSTABLE_402' logged within the past 48 hours; 7-day runtime is 42.5% above the 30-day daily average. Immediate inspection and intervention required."*

---

## 🔑 Demo Personas & Credentials

The system seeds with pre-configured personas for demonstration and role-based access testing:

| Role | Persona Name | Email | Password | Access Scope |
|---|---|---|---|---|
| **Admin** | Chief Facilities Officer | `admin@ops.local` | `Admin@12345` | Global (Full access across all departments) |
| **DepartmentStaff** | Marcus Vance | `electrical@ops.local` | `Staff@12345` | Scoped strictly to **Electrical** department |
| **DepartmentStaff** | Elena Rostova | `hvac@ops.local` | `Staff@12345` | Scoped strictly to **HVAC** department |
| **DepartmentStaff** | David Chen | `plumbing@ops.local` | `Staff@12345` | Scoped strictly to **Plumbing** department |

---

## 📂 Repository Structure

```
├── ai-service/                   # Python FastAPI AI Analysis Microservice
│   ├── main.py                   # FastAPI service endpoints (/health, /analyze)
│   ├── rules_engine.py           # Core implementation of Rules 1-4 and summary generator
│   ├── test_rules_engine.py      # Unit test suite for rules logic
│   ├── test_api.py               # HTTP endpoint integration test
│   └── requirements.txt          # Python dependencies (fastapi, uvicorn, pydantic, httpx)
├── backend/                      # Node.js Express API Backend
│   ├── src/
│   │   ├── config/db.js          # MongoDB connection helper
│   │   ├── models/               # Mongoose data models
│   │   │   ├── Asset.js          # Physical equipment registry
│   │   │   ├── Reading.js        # Historical & live telemetry readings
│   │   │   ├── MaintenanceLog.js # Audit trail (ai-flag, manual-entry, resolution)
│   │   │   ├── User.js           # Auth user schema (Admin, DepartmentStaff)
│   │   │   └── Alert.js          # Department incident alert documents
│   │   ├── middleware/auth.js    # JWT verification & RBAC department guards
│   │   ├── controllers/          # Request handlers
│   │   ├── routes/               # Express REST route definitions
│   │   ├── services/
│   │   │   ├── aiService.js      # Bridge calling Python AI service with fallback
│   │   │   └── seedService.js    # 35+ days historical readings & demo scenarios generator
│   │   ├── tests/                # Automated verification suites
│   │   │   ├── verify_models.js  # Schema & validation tests
│   │   │   ├── verify_api_endpoints.js # Full API endpoint suite (19 checks)
│   │   │   ├── verify_rbac.js    # RBAC & cross-department boundary tests
│   │   │   └── verify_alert_routing.js # Alert lifecycle & deduplication tests
│   │   └── server.js             # Main Express server entry point
│   ├── .env.example              # Environment variables template
│   └── package.json
└── frontend/                     # React + Vite Frontend
    ├── src/
    │   ├── api/client.js         # Axios client with JWT auto-injection
    │   ├── context/AuthContext.jsx # Authentication state & role helpers
    │   ├── components/
    │   │   ├── Navbar.jsx        # Navigation, user profile, seed demo data button
    │   │   ├── StatusBadge.jsx   # Distinct Healthy/Watch/Critical badge indicators
    │   │   ├── MetricCards.jsx   # Overview statistics & quick status filters
    │   │   ├── FilterBar.jsx     # Live text search, department/type/status dropdowns
    │   │   ├── AssetCard.jsx     # Asset display cards with maintenance countdowns
    │   │   ├── TimeSeriesChart.jsx # Recharts telemetry chart with threshold lines
    │   │   ├── AssetDetailModal.jsx # Detail drawer with live telemetry ingestion & logs
    │   │   ├── AlertsQueue.jsx   # Department incident queue with acknowledge/resolve
    │   │   └── AssetFormModal.jsx # Admin asset registration & edit modal
    │   ├── pages/
    │   │   ├── LoginPage.jsx     # Glassmorphism login with demo quick-select
    │   │   ├── DashboardPage.jsx # Main operations dashboard
    │   │   └── LogsPage.jsx      # System-wide maintenance audit trail
    │   ├── App.jsx
    │   └── index.css
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ recommended, v22 supported)
- **Python** (v3.10+ recommended, v3.13 supported)
- **MongoDB** (Local instance running at `mongodb://localhost:27017` or MongoDB Atlas URI)

---

### Step 1: Start the Python AI Analysis Service
```bash
cd "ai-service"

# Install dependencies
pip install -r requirements.txt

# Start FastAPI microservice (runs on port 8000)
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Health check: `http://127.0.0.1:8000/health`

---

### Step 2: Start the Backend API
In a new terminal:
```bash
cd "backend"

# Configure environment variables (defaults to local MongoDB)
cp .env.example .env

# Install dependencies
npm install

# Start Express server (runs on port 5000)
npm start
```

---

### Step 3: Start the Frontend Application
In a third terminal:
```bash
cd "frontend"

# Install dependencies
npm install

# Launch Vite development server (runs on port 3000)
npm run dev
```
Open **`http://localhost:3000`** in your browser.

---

### Step 4: Seed Demo Data
Once logged into the dashboard as **Admin** (`admin@ops.local` / `Admin@12345`):
- Click the **"Seed Demo Data"** button in the top navigation bar, or call:
```bash
curl -X POST http://localhost:5000/api/assets/seed
```
This generates:
- 4 default user personas across roles and departments.
- 7 facility assets across Electrical, HVAC, Plumbing, IT, and General.
- Over 35 days of daily telemetry readings per asset with realistic runtime spikes, temperature fluctuations, and error codes triggering Healthy, Watch, and Critical states.
- Initial alerts and corresponding `ai-flag` maintenance logs.

---

## 📡 API Reference Summary

### Auth
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Provisions new user account | Admin only |
| `POST` | `/api/auth/login` | Returns signed JWT token | Public |
| `GET` | `/api/auth/me` | Returns current user profile | Authenticated |

### Assets
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/assets` | Register a new facility asset | Admin only |
| `GET` | `/api/assets` | List assets (`?location=&type=&department=&status=`) | Scoped to Dept for Staff |
| `GET` | `/api/assets/:id` | Get single asset details | Scoped to Dept for Staff |
| `PUT` | `/api/assets/:id` | Update asset metadata | Admin only |
| `DELETE` | `/api/assets/:id` | Soft delete asset (`active: false`) | Admin only |
| `GET` | `/api/assets/:id/status` | Get cached status and AI recommendation | Scoped to Dept for Staff |
| `POST` | `/api/assets/:id/analyze` | Manually re-trigger AI analysis | Scoped to Dept for Staff |

### Telemetry Readings
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/assets/:id/readings` | Ingest live sensor reading (auto-triggers AI) | Scoped to Dept for Staff |
| `GET` | `/api/assets/:id/readings` | Telemetry history (`?from=&to=`) | Scoped to Dept for Staff |
| `POST` | `/api/assets/seed` | Dev-only seed script (35+ days readings) | Public / Dev |

### Alerts & Incident Routing
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/alerts` | List alerts (`?department=&status=&acknowledged=`) | Scoped to Dept for Staff |
| `GET` | `/api/alerts/:id` | Get single alert details | Scoped to Dept for Staff |
| `PATCH` | `/api/alerts/:id/acknowledge` | Mark alert acknowledged | Scoped to Dept for Staff |
| `PATCH` | `/api/alerts/:id/resolve` | Resolve alert (requires `resolutionNote`) | Scoped to Dept for Staff |

### Maintenance Logs
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/assets/:id/logs` | Record manual maintenance entry | Scoped to Dept for Staff |
| `GET` | `/api/assets/:id/logs` | Full chronological audit trail for asset | Scoped to Dept for Staff |

### Dashboard Summary
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | Aggregate counts by status and department | Authenticated |

---

## 🧪 Automated Test Suites

The codebase includes end-to-end automated verification scripts:

```bash
# 1. Verify Mongoose Schemas, Validations, and Defaults
npm run test:models   # (in backend/)

# 2. Verify all 19 API Endpoints & Acceptance Criteria
npm run test:api      # (in backend/)

# 3. Verify Server-Side RBAC & Cross-Department Boundaries
npm run test:rbac     # (in backend/)

# 4. Verify Alert Routing, Deduplication, and Audit Log Generation
npm run test:alerts   # (in backend/)

# 5. Verify Python Rules Engine Logic & API Microservice
python test_rules_engine.py  # (in ai-service/)
python test_api.py           # (in ai-service/)

# 6. Verify Production Frontend Build
npm run build         # (in frontend/)
```

---

## 🔒 Security & Governance Guarantees

- **No Hardcoded Secrets**: DB URIs, JWT secrets, and microservice URLs are strictly loaded from environment variables (`.env`).
- **Server-Side Authorization**: DepartmentStaff cannot access, modify, ingest readings for, or resolve alerts on equipment outside their assigned department (enforced at controller and middleware levels, returning `403 Forbidden`).
- **Audit Trail Integrity**: Resolving an alert requires a non-empty `resolutionNote` that is permanently committed to the asset's audit history as a `resolution` log referencing the alert ID and technician.
- **Alert Deduplication**: Sustained anomalous readings update the active alert rather than flooding the department queue with duplicate tickets.
