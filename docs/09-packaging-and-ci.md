# Phase 9: Packaging and Continuous Integration (CI)

---

## 1. What We Built in This Phase
In this phase, we packaged our application for enterprise-ready deployment using multi-stage Docker builds, added automated CI pipelines via GitHub Actions, created a comprehensive `.dockerignore`, and wrote a production-grade `README.md`.

---

## 2. Why This Exists (The Problem It Solves)
1. **Container Bloat & Security**: A naive Docker image copies all source files, dev dependencies, build tools, and runs as `root`. If a container running as root is compromised, the attacker can break out into the host OS. Our multi-stage build creates a tiny production container that runs under the unprivileged `node` user and excludes source TypeScript/Vite compilers.
2. **Automated Quality Gate**: A GitHub Actions workflow runs `npm audit`, builds the React frontend, runs the full integration test suite against live PostgreSQL and Redis services, and rejects pull requests that introduce regressions or vulnerabilities.

---

## 3. How It Works

### Multi-Stage Docker Build Architecture
```
Stage 1: Frontend Builder (node:20-alpine)
├── Copy frontend/package*.json
├── npm ci
├── Compile React bundle (Vite -> frontend/dist)
│
Stage 2: Production Runner (node:20-alpine)
├── Set unprivileged non-root USER node
├── Install production-only backend packages (npm ci --only=production)
├── Copy src/ and compiled frontend/dist/
├── Expose Port 3000
└── CMD ["node", "src/server.js"]
```

---

## 4. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)

The CI pipeline runs on every `push` and `pull_request` to `master` and `main`:
1. **Spins up ephemeral service containers**:
   - `postgres:16-alpine` on port 5433 with automated health checks (`pg_isready`).
   - `redis:7-alpine` on port 6380 with health checks (`redis-cli ping`).
2. **Dependency Security Audit**: Runs `npm audit --audit-level=high`.
3. **Builds React Frontend**: Compiles static distribution bundle.
4. **Initializes Schema**: Executes `src/models/schema.sql`.
5. **Executes Test Suite**: Runs all integration and security tests against the live containers.

---

## 5. Security Notes

- **Non-Root Execution (`USER node`)**:
  - By default, Docker containers execute as `root` (UID 0).
  - Running as `USER node` ensures that even if an attacker discovers a Remote Code Execution (RCE) flaw, they cannot modify system packages, mount devices, or escape container namespaces.
- **`.dockerignore` Exclusion**:
  - Excludes local `.env` files, `.git/` history, and local `node_modules/` from ever being baked into the Docker image layers.

---

## 6. Interview Questions (Phase 9 Drill)

1. **Why do production Docker images use multi-stage builds instead of installing build tools directly in the final container?**
2. **Why is running a container as a non-root user (`USER node`) a critical security best practice?**
3. **What is the difference between `npm install` and `npm ci` in continuous integration pipelines?**

