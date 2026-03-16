# Engineering Portfolio Planner

A capacity planning and portfolio management tool for engineering organisations. Import your team structure, project pipeline, and effort patterns from Excel, then visualise demand vs capacity gaps, hiring forecasts, utilisation heatmaps, and project health across PODs and roles.

![Tech Stack](https://img.shields.io/badge/Java-21-orange) ![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4-green) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)

---

## Features

- **Excel import** — upload a single `.xlsx` file to load your full org structure (timeline, resources, PODs, projects, effort patterns, BAU assumptions, cost rates, actuals)
- **Capacity vs Demand** — monthly gap analysis per POD and role
- **Hiring forecast** — cumulative FTE recommendations using org-wide surplus/deficit netting
- **Utilisation heatmap** — colour-coded overload detection across all resources
- **Project health** — deadline risk, concurrency risk, and Gantt view
- **Scenario simulator** — what-if capacity modelling with temporary overrides
- **POD splits** — model resources shared across multiple PODs with configurable FTE allocation
- **Cost rates** — hourly rates per role/location for project cost estimation
- **Standalone HTML app** — zero-install single-file version (`eng_portfolio_v2.html`) for quick use without a server

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Spring Boot 3.4, Java 21, JPA/Hibernate, MapStruct, Lombok |
| Database | PostgreSQL 15 (production), H2 (tests) |
| Migrations | Flyway |
| Frontend | React 18, TypeScript 5.6, Vite, Mantine UI, TanStack Query |
| Charts | Recharts |
| Excel parsing | Apache POI |
| Tests — backend | JUnit 5, AssertJ, Mockito, MockMvc |
| Tests — frontend | Vitest, React Testing Library, MSW |
| Tests — HTML app | Vitest (Node), zero-dependency runner |

---

## Project Structure

```
├── backend/                   Spring Boot API
│   ├── src/main/java/
│   │   └── com/portfolioplanner/
│   │       ├── controller/    REST endpoints
│   │       ├── service/       Business logic + Excel import
│   │       ├── domain/        JPA entities + repositories
│   │       ├── dto/           Request / response records
│   │       ├── mapper/        MapStruct entity ↔ DTO mappers
│   │       └── config/        CORS, caching
│   └── src/test/java/
│       └── com/portfolioplanner/
│           ├── calculation/   Unit tests (DemandCalculator, CapacityCalculator, HiringForecastCalculator)
│           ├── service/       ExcelImportService parser tests
│           └── controller/    Functional (MockMvc + H2) tests
│
├── frontend/                  React + TypeScript SPA
│   ├── src/
│   │   ├── api/               Axios hooks (TanStack Query)
│   │   ├── pages/             Route-level components
│   │   ├── types/             TypeScript interfaces
│   │   └── utils/             Formatting + colour helpers
│   └── src/*/  __tests__/     Vitest + RTL + MSW tests
│
└── HTML - Project Planner/
    ├── eng_portfolio_v2.html  Standalone single-file app
    └── deploy/tests/          Pure-function tests (Node, no npm install)
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Java JDK | 21+ |
| Maven | 3.9+ |
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 15+ |

---

## Local Development

### 1. Database

```bash
psql -U postgres
CREATE DATABASE portfolio_planner;
CREATE USER planner_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO planner_user;
\c portfolio_planner
GRANT ALL ON SCHEMA public TO planner_user;
\q
```

### 2. Backend

```bash
cd backend

export DB_USERNAME=planner_user
export DB_PASSWORD=your_password

# Run (Flyway migrations run automatically on first start)
./mvnw spring-boot:run
# → http://localhost:8080
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Vite proxies all `/api` requests to `localhost:8080` — no extra config needed.

### 4. Standalone HTML app

Open `HTML - Project Planner/eng_portfolio_v2.html` directly in a browser. No server required.

---

## Running Tests

### Backend (unit + functional)

```bash
cd backend
mvn test                                    # all tests
mvn test -Dtest="*CalculatorTest"          # unit tests only
mvn test -Dtest="*ControllerTest"          # functional tests only (MockMvc + H2)
```

### Frontend

```bash
cd frontend
npm install     # first time only
npm test        # runs all Vitest tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

### Standalone HTML app

```bash
cd "HTML - Project Planner/deploy/tests"
node run-tests.mjs    # zero dependencies — pure Node
```

---

## Excel Import

Download the template from the app's **Import** page (or from `frontend/public/sample_import_template.xlsx`). Fill in the 12 sheets and upload via **Import Excel** in the UI.

| Sheet | Contents |
|---|---|
| Timeline | Start year/month, working hours per month |
| Sizing | T-shirt sizes, role effort mix %, POD complexity |
| Effort Patterns | Named monthly weight distributions |
| Resources | People, roles, locations, FTE |
| Availability | Monthly available hours per person |
| Assumptions | BAU % per POD and role |
| POD Planning | Project ↔ POD assignments with size and pattern |
| POD Splits | Cross-POD resource allocations |
| Projects | Project names, priorities, statuses, owners |
| Cost Rates | Hourly rate per role and location |
| Skills | Resource skill tags |
| Actuals | Actual hours logged per project per month |

---

## Deployment

### Frontend → Vercel

1. Import the `frontend/` directory in [vercel.com](https://vercel.com)
2. Set environment variable: `VITE_API_URL=https://your-backend.up.railway.app`
3. Deploy — SPA routing is handled by `vercel.json`

### Backend → Railway

1. Import the `backend/` directory in [railway.app](https://railway.app)
2. Add a PostgreSQL plugin — Railway wires the connection string automatically
3. Set environment variable: `ALLOWED_ORIGINS=https://your-app.vercel.app`
4. Railway builds and deploys automatically on every push

### Environment variables reference

**Backend (Railway)**

| Variable | Example | Notes |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://...` | Auto-set by Railway PostgreSQL |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Auto-set by Railway |
| `SPRING_DATASOURCE_PASSWORD` | `...` | Auto-set by Railway |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | CORS allowed origins |

**Frontend (Vercel)**

| Variable | Example | Notes |
|---|---|---|
| `VITE_API_URL` | `https://your-backend.up.railway.app` | Backend base URL (no trailing slash) |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/resources` | List all resources |
| POST | `/api/resources` | Create resource |
| PUT | `/api/resources/{id}` | Update resource |
| DELETE | `/api/resources/{id}` | Delete resource |
| PUT | `/api/resources/{id}/assignment` | Assign to POD |
| GET | `/api/projects` | List projects (optional `?status=ACTIVE`) |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/{id}/pod-planning` | Set POD planning entries |
| GET | `/api/pods` | List PODs |
| GET | `/api/cost-rates` | List cost rates |
| GET | `/api/actuals` | All project actuals |
| GET | `/api/actuals/by-project/{id}` | Actuals for one project |
| GET | `/api/reports/capacity-gap` | Monthly capacity vs demand gap |
| GET | `/api/reports/hiring-forecast` | Incremental FTE hiring plan |
| GET | `/api/reports/utilisation` | Utilisation heatmap data |
| POST | `/api/import` | Upload Excel file |

---

## License

MIT
