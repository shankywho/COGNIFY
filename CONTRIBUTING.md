# Contributing to Cognify

Thank you for your interest in contributing to Cognify! This guide outlines our project architecture, development workflow, and coding standards.

---

## Repository Architecture

Cognify is organized with an **Exposed Top-Level Architecture** so that every core subsystem is immediately accessible from the repository root:

* **[web/](web/)**: Frontend Single Page Application built with React 19, TypeScript, Vite, and Tailwind CSS.
  * `src/components/`: Reusable UI primitives, layout widgets, marketing components, and canvas visualizations.
  * `src/pages/`: Route views divided into `dashboard/` (SaaS cockpit) and `landingpage/` (marketing & onboarding).
  * `src/context/`, `src/hooks/`, `src/constants/`, `src/icons/`, `src/lib/`: Modular application utilities, state providers, and assets.
  * `@/*`: Standard path alias mapping directly to `src/*`.

* **[server/](server/)**: Backend API and automation worker services built with Express 5, TypeScript, Prisma ORM, and BullMQ.
  * `src/routes/`: RESTful API route definitions.
  * `src/services/`: Core domain logic (multi-agent routing, vector memory, storage, billing, integrations).
  * `src/queues/`: BullMQ asynchronous job queues and background execution workers.
  * `src/middleware/`: Security headers, JWT validation, rate limiting, and workspace RBAC.

* **[database/](database/)**: PostgreSQL data models, Prisma schema, migration history, and seed scripts.

* **[docker/](docker/)**: Container configurations (`docker-compose.yml`, `Dockerfile.server`, `Dockerfile.web`).

* **[docs/](docs/)**: In-depth technical documentation:
  * `ARCHITECTURE.md`: High-level system design and data flow.
  * `AGENTS.md`: Autonomous agent routing, personas, and memory context injection.
  * `WORKFLOWS.md`: Graph canvas builder, step executor, and background job engine.
  * `API.md`: Comprehensive REST API, SSE, and WebSocket references.

* **[scripts/](scripts/)**: Developer automation (`dev.sh`, `seed.sh`, `deploy.sh`).

---

## Getting Started Locally

### Prerequisites
* **Node.js**: v18+ or v20+
* **Docker & Docker Compose**: (Recommended for PostgreSQL and Redis)
* **npm**: v9+

### 1. Clone & Install Dependencies
From the repository root:
```bash
git clone https://github.com/cognify-ai/cognify.git
cd cognify
npm install
```

### 2. Start Supporting Services
Start PostgreSQL and Redis in the background:
```bash
npm run docker:up
```

### 3. Configure Environment Variables
Copy `.env.example` into `server/.env`:
```bash
cp .env.example server/.env
```
Ensure your database connection string and secret keys are set.

### 4. Database Setup
Generate the Prisma client and push database schemas:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 5. Start Development Servers
Run both web and server concurrently:
```bash
npm run dev
```
* **Frontend**: `http://localhost:5173`
* **Backend**: `http://localhost:3000`

---

## Building & Verification

Verify the entire repository before submitting a pull request:
```bash
# Build both web and server
npm run build

# Or build individually
npm run build:web
npm run build:server
```

---

## Pull Request Guidelines

1. Create a feature branch: `git checkout -b feature/your-feature-name`.
2. Keep pull requests focused on a single responsibility.
3. Ensure both `npm run build:web` and `npm run build:server` succeed with zero errors.
4. Open a Pull Request referencing any relevant issues.
