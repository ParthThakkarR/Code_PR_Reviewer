---
phase: 10
plan: 1
wave: 1
depends_on: []
files_modified:
  - backend_express/Dockerfile
  - docker-compose.yml
  - .dockerignore
autonomous: true

must_haves:
  truths:
    - "Backend Dockerfile uses non-root user, multi-stage build or pinned LTS, npm ci --omit=dev, and HEALTHCHECK"
    - "docker-compose.yml defines backend, frontend, mongodb, redis with persistent volumes and healthchecks"
    - ".dockerignore prevents local node_modules, .env, and secrets from entering image"
  artifacts:
    - "backend_express/Dockerfile hardened"
    - "docker-compose.yml configured for multi-tier setup"
    - ".dockerignore configured"
---

# Plan 10.1: Hardened Containerization & Docker Orchestration

<objective>
Harden container definitions for production: non-root users, production dependency scoping, healthchecks, and complete Docker Compose topology.

Purpose: Requirements #58, #59 — secure container baseline and predictable multi-service local deployment.
Output: Production Dockerfile, docker-compose.yml, and .dockerignore.
</objective>

<context>
Load for context:
- backend_express/Dockerfile
- docker-compose.yml (if exists)
</context>

<tasks>

<task type="auto">
  <name>Harden backend Dockerfile and define .dockerignore</name>
  <files>backend_express/Dockerfile, .dockerignore</files>
  <action>
    1. Update backend_express/Dockerfile:
       - Base on `node:22-alpine` (current LTS)
       - Set `ENV NODE_ENV=production`
       - Copy package files and run `npm ci --omit=dev`
       - Create unprivileged user `appuser` (UID 10001) and switch `USER appuser`
       - Define `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:5001/healthz || exit 1`
       - Expose port 5001
    2. Create .dockerignore in root and backend_express:
       - node_modules, .env, .git, .planning, coverage, *.log
  </action>
  <verify>
    grep "USER appuser" backend_express/Dockerfile
  </verify>
  <done>
    Dockerfile hardened with unprivileged user, healthcheck, and optimized dependencies.
  </done>
</task>

<task type="auto">
  <name>Create complete docker-compose.yml for local multi-service orchestration</name>
  <files>docker-compose.yml</files>
  <action>
    Create docker-compose.yml defining:
    - backend (build ./backend_express, ports 5001:5001, depends_on mongo & redis, healthcheck)
    - mongo (mongo:7.0, ports 27017:27017, volume mongo-data)
    - redis (redis:7-alpine, ports 6379:6379, volume redis-data)
    - frontend (build ./frontend, ports 5173:5173, depends_on backend)
    Volumes: mongo-data, redis-data.
  </action>
  <verify>
    Test-Path docker-compose.yml
  </verify>
  <done>
    docker-compose.yml configured with data stores, networking, and volume persistence.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Dockerfile contains HEALTHCHECK and USER appuser
- [ ] docker-compose.yml defines all services
</verification>

<success_criteria>
- [ ] Container deployment artifacts ready and verified
</success_criteria>
