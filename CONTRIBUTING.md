# Contributing to Code_PR_Reviewer

Thank you for your interest in improving Code_PR_Reviewer!

## Prerequisites

- Node.js 20+ (Node 22 LTS recommended)
- Python 3.10+
- MongoDB 7.0+
- Redis 7.0+ (for BullMQ job queues and rate limits)

## Local Development Workflow

1. Clone the repository and install dependencies:
   ```bash
   cd backend_express && npm install
   cd ../frontend && npm install
   ```

2. Set up environment variables:
   ```bash
   cp backend_express/.env.example backend_express/.env
   # Edit .env with your local credentials and SESSION_SECRET
   ```

3. Run the automated test suite:
   ```bash
   cd backend_express && npm test
   ```

4. Build frontend assets:
   ```bash
   cd frontend && npm run build
   ```

5. Run with Docker Compose:
   ```bash
   docker compose up --build
   ```

## Pull Request Guidelines

- All PRs must pass the built-in automated test suite (`npm test`).
- PRs introducing new dependencies must pass the Google OSV vulnerability check without Critical or High CVEs.
- Keep commits atomic and adhere to standard Conventional Commits syntax (`feat:`, `fix:`, `security:`, `docs:`).
