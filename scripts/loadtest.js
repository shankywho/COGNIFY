// Usage:
// k6 run -e BASE_URL=http://localhost:3000 -e TOKEN=<JWT_BEARER_TOKEN> -e WORKFLOW_ID=<WORKFLOW_ID> scripts/loadtest.js
// Example: k6 run -e BASE_URL=http://localhost:3000 -e TOKEN=eyJhbGciOi... -e WORKFLOW_ID=wf-seed-support-triage scripts/loadtest.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Custom Metrics
const serverErrors = new Counter("server_errors");
const idempotentHits = new Counter("idempotent_hits");
const rateLimitHits = new Counter("rate_limit_hits");
const backpressureHits = new Counter("backpressure_hits");
const ingressLatency = new Trend("ingress_latency", true);

export const options = {
  scenarios: {
    // Scenario 1: 50 VUs Concurrent Burst testing Idempotency & P95 Ingress
    concurrency_and_idempotency: {
      executor: "constant-vus",
      vus: 50,
      duration: "15s",
      exec: "testIdempotencyAndConcurrency",
    },
    // Scenario 2: Bursting past rate limits to verify 429 / 503 + Retry-After headers
    rate_limit_and_backpressure: {
      executor: "ramping-arrival-rate",
      startRate: 20,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 100,
      startTime: "16s",
      stages: [
        { target: 150, duration: "10s" },
        { target: 0, duration: "5s" },
      ],
      exec: "testRateLimitAndBackpressure",
    },
  },
  thresholds: {
    // Assert zero 500 Internal Server Errors
    server_errors: ["count==0"],
    // Assert P95 Ingress Latency < 150ms for concurrent trigger endpoint
    "ingress_latency{scenario:concurrency_and_idempotency}": ["p(95)<150"],
    // Assert rate limiting or backpressure protections engage under burst
    rate_limit_hits: ["count>0"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TOKEN = __ENV.TOKEN || "dev-mock-jwt-token";
const WORKFLOW_ID = __ENV.WORKFLOW_ID || "wf-seed-support-triage";

const baseHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
};

/**
 * Scenario 1: 50 Concurrent VUs testing Race-Free Idempotency & Latency
 */
export function testIdempotencyAndConcurrency() {
  const url = `${BASE_URL}/api/workflows/${WORKFLOW_ID}/run`;

  // 50% shared idempotency keys (testing race-free duplicate deduplication)
  // 50% unique idempotency keys (testing high-concurrency throughput)
  const isShared = Math.random() < 0.5;
  const idempotencyKey = isShared
    ? `shared-load-key-bucket-${Math.floor(Math.random() * 5)}`
    : `unique-key-vu${__VU}-iter${__ITER}-${Date.now()}`;

  const payload = JSON.stringify({
    inputVariables: {
      source: "k6-load-benchmark",
      testType: "concurrency_burst",
      timestamp: Date.now(),
    },
  });

  const headers = Object.assign({}, baseHeaders, {
    "Idempotency-Key": idempotencyKey,
  });

  const startTime = Date.now();
  const res = http.post(url, payload, { headers, tags: { scenario: "concurrency_and_idempotency" } });
  const latency = Date.now() - startTime;
  ingressLatency.add(latency, { scenario: "concurrency_and_idempotency" });

  if (res.status >= 500) {
    serverErrors.add(1);
  }

  const passed = check(res, {
    "zero 500 server errors": (r) => r.status < 500,
    "valid response status (200, 201, 402, 429, 503)": (r) =>
      [200, 201, 402, 429, 503].includes(r.status),
  });

  if (res.status === 200 && res.body && res.body.includes('"duplicate":true')) {
    idempotentHits.add(1);
  }

  sleep(0.05); // 50ms pacing between VU iterations
}

/**
 * Scenario 2: Bursting past limits to verify 429 / 503 + Retry-After headers
 */
export function testRateLimitAndBackpressure() {
  const url = `${BASE_URL}/api/workflows/${WORKFLOW_ID}/run`;

  const headers = Object.assign({}, baseHeaders, {
    "Idempotency-Key": `burst-vu${__VU}-iter${__ITER}-${Date.now()}-${Math.random()}`,
  });

  const payload = JSON.stringify({
    inputVariables: {
      message: "Stress testing burst rate limit and load shedding capacity",
    },
  });

  const res = http.post(url, payload, { headers, tags: { scenario: "rate_limit_and_backpressure" } });

  if (res.status >= 500 && res.status !== 503) {
    serverErrors.add(1);
  }

  if (res.status === 429) {
    rateLimitHits.add(1);
  }

  if (res.status === 503) {
    backpressureHits.add(1);
  }

  check(res, {
    "handles load gracefully without unhandled 500": (r) => r.status !== 500,
    "returns Retry-After header on 429/503": (r) => {
      if (r.status === 429 || r.status === 503) {
        return Boolean(r.headers["Retry-After"] || r.headers["retry-after"]);
      }
      return true;
    },
  });
}
