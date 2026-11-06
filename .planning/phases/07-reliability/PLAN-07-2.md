---
phase: 7
plan: 2
wave: 2
depends_on: [7.1]
files_modified:
  - backend_express/queue/reviewQueue.js
  - backend_express/workers/reviewWorker.js
autonomous: true

must_haves:
  truths:
    - "Queue jobs configured with exponential backoff, retry attempts (3), and timeouts"
    - "Worker handles SIGTERM/SIGINT with graceful shutdown"
    - "Jobs have terminal 'failed' event handler and idempotency key support"
  artifacts:
    - "reviewQueue.js defines defaultJobOptions with backoff and attempts"
    - "reviewWorker.js listens to SIGTERM and closes cleanly"
---

# Plan 7.2: Background Queue Hardening & Worker Graceful Shutdown

<objective>
Configure queue jobs with exponential backoff, timeouts, idempotency keys, and graceful shutdown on SIGTERM/SIGINT.

Purpose: Requirements #35, #36 — background task resilience and clean container shutdown.
Output: Resilient BullMQ options in reviewQueue.js, graceful termination handlers in reviewWorker.js.
</objective>

<context>
Load for context:
- backend_express/queue/reviewQueue.js
- backend_express/workers/reviewWorker.js
</context>

<tasks>

<task type="auto">
  <name>Configure BullMQ retry, backoff, and idempotency options</name>
  <files>backend_express/queue/reviewQueue.js</files>
  <action>
    In reviewQueue.js, update default job options:
    - attempts: 3
    - backoff: { type: "exponential", delay: 5000 }
    - removeOnComplete: { count: 100 }
    - removeOnFail: { count: 500 }
    Ensure jobs accept `jobId` for idempotency (e.g. `pr-check-${owner}-${repo}-${prNumber}-${headSha}`).
  </action>
  <verify>
    grep "exponential" backend_express/queue/reviewQueue.js
  </verify>
  <done>
    Job queue configured with exponential backoff and retry policies.
  </done>
</task>

<task type="auto">
  <name>Add graceful shutdown handlers to reviewWorker</name>
  <files>backend_express/workers/reviewWorker.js</files>
  <action>
    In reviewWorker.js:
    Add process signal listeners:
    ```js
    const shutdown = async (signal) => {
      console.log(`Received ${signal}, closing worker gracefully...`);
      try {
        if (worker) await worker.close();
        process.exit(0);
      } catch (err) {
        console.error("Error during worker shutdown:", err);
        process.exit(1);
      }
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    ```
  </action>
  <verify>
    grep "SIGTERM" backend_express/workers/reviewWorker.js
  </verify>
  <done>
    Worker process gracefully closes active jobs on SIGTERM/SIGINT.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] reviewQueue.js contains backoff: { type: 'exponential' }
- [ ] reviewWorker.js has SIGTERM/SIGINT listeners
</verification>

<success_criteria>
- [ ] Queue and worker reliability hardened
</success_criteria>
