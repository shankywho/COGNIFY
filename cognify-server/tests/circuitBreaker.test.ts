import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
  LLMGateway,
} from "../src/services/ai/circuitBreaker";
import { AIProvider } from "../src/services/ai/providers/base.providers";

describe("CircuitBreaker - Deterministic Fault-Tolerance & Fast-Fail State Machine", () => {
  test("initial state is CLOSED and successful executions return results", async () => {
    const breaker = new CircuitBreaker({
      name: "TestBreaker",
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    });

    assert.strictEqual(breaker.getState(), "CLOSED");
    assert.strictEqual(breaker.getFailureCount(), 0);

    const result = await breaker.execute(async () => "success-payload");
    assert.strictEqual(result, "success-payload");
    assert.strictEqual(breaker.getState(), "CLOSED");
    assert.strictEqual(breaker.getFailureCount(), 0);
  });

  test("trips from CLOSED to OPEN after failureThreshold consecutive failures", async () => {
    const breaker = new CircuitBreaker({
      name: "FlakyProvider",
      failureThreshold: 3,
      resetTimeoutMs: 2000,
    });

    // Fail 1
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("503 Upstream Gateway Error");
      });
    }, /503 Upstream Gateway Error/);
    assert.strictEqual(breaker.getState(), "CLOSED");
    assert.strictEqual(breaker.getFailureCount(), 1);

    // Fail 2
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("429 Rate Limit Exceeded");
      });
    }, /429 Rate Limit Exceeded/);
    assert.strictEqual(breaker.getState(), "CLOSED");
    assert.strictEqual(breaker.getFailureCount(), 2);

    // Fail 3 (Threshold reached)
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("Socket Hang Up");
      });
    }, /Socket Hang Up/);

    assert.strictEqual(breaker.getState(), "OPEN");
    assert.strictEqual(breaker.getFailureCount(), 3);
    assert.ok(breaker.getNextAttempt() > Date.now());
  });

  test("fast-fails immediately while OPEN without calling underlying function", async () => {
    const breaker = new CircuitBreaker({
      name: "OpenBreaker",
      failureThreshold: 1,
      resetTimeoutMs: 5000,
    });

    // Trip it
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("Network Crash");
      });
    });
    assert.strictEqual(breaker.getState(), "OPEN");

    let underlyingCalled = false;
    await assert.rejects(
      async () => {
        await breaker.execute(async () => {
          underlyingCalled = true;
          return "should-not-run";
        });
      },
      (err: any) => {
        assert.ok(err instanceof CircuitBreakerOpenError);
        assert.strictEqual(err.state, "OPEN");
        return true;
      }
    );

    assert.strictEqual(underlyingCalled, false, "Underlying function must NOT be invoked when breaker is OPEN");
  });

  test("transitions to HALF_OPEN after resetTimeoutMs and recovers to CLOSED on success", async () => {
    const breaker = new CircuitBreaker({
      name: "RecoveringBreaker",
      failureThreshold: 1,
      resetTimeoutMs: 50, // 50ms for test speed
    });

    // Trip it
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("Trip error");
      });
    });
    assert.strictEqual(breaker.getState(), "OPEN");

    // Wait past resetTimeoutMs
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.strictEqual(breaker.getState(), "HALF_OPEN");

    // Trial request succeeds
    const recovered = await breaker.execute(async () => "healed-response");
    assert.strictEqual(recovered, "healed-response");
    assert.strictEqual(breaker.getState(), "CLOSED");
    assert.strictEqual(breaker.getFailureCount(), 0);
  });

  test("HALF_OPEN immediately re-trips to OPEN if trial request fails", async () => {
    const breaker = new CircuitBreaker({
      name: "RelapseBreaker",
      failureThreshold: 1,
      resetTimeoutMs: 50,
    });

    // Trip to OPEN
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("Trip error");
      });
    });

    // Wait until HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.strictEqual(breaker.getState(), "HALF_OPEN");

    // Trial request fails
    await assert.rejects(async () => {
      await breaker.execute(async () => {
        throw new Error("Trial failed");
      });
    });

    // Must be back to OPEN immediately
    assert.strictEqual(breaker.getState(), "OPEN");
  });

  test("enforces requestTimeoutMs and counts hung requests as failures", async () => {
    const breaker = new CircuitBreaker({
      name: "TimeoutBreaker",
      failureThreshold: 2,
      requestTimeoutMs: 50, // 50ms timeout
    });

    await assert.rejects(
      async () => {
        await breaker.execute(
          () => new Promise((resolve) => setTimeout(() => resolve("slow"), 200))
        );
      },
      (err: any) => {
        assert.ok(err instanceof CircuitBreakerTimeoutError);
        assert.ok(err.message.includes("timed out after 50ms"));
        return true;
      }
    );

    assert.strictEqual(breaker.getFailureCount(), 1);
  });

  test("LLMGateway automatically routes to fallback provider when primary breaker trips", async () => {
    let primaryCallCount = 0;
    let fallbackCallCount = 0;

    const mockPrimary: AIProvider = {
      async generateResponse() {
        primaryCallCount++;
        throw new Error("Primary API 500 Outage");
      },
    };

    const mockFallback: AIProvider = {
      async generateResponse(prompt: string) {
        fallbackCallCount++;
        return `Fallback response to: ${prompt}`;
      },
    };

    const primaryBreaker = new CircuitBreaker({
      name: "MockPrimary",
      failureThreshold: 2,
      resetTimeoutMs: 1000,
    });

    const gateway = new LLMGateway(mockPrimary, mockFallback, { primaryBreaker });

    // Request 1: Primary fails, routes to fallback
    const res1 = await gateway.generate("test prompt 1");
    assert.strictEqual(res1, "Fallback response to: test prompt 1");
    assert.strictEqual(primaryCallCount, 1);
    assert.strictEqual(fallbackCallCount, 1);

    // Request 2: Primary fails again (threshold reached), routes to fallback
    const res2 = await gateway.generate("test prompt 2");
    assert.strictEqual(res2, "Fallback response to: test prompt 2");
    assert.strictEqual(primaryCallCount, 2);
    assert.strictEqual(fallbackCallCount, 2);
    assert.strictEqual(primaryBreaker.getState(), "OPEN");

    // Request 3: Primary breaker is OPEN -> fast-fails in 0ms and immediately uses fallback
    const res3 = await gateway.generate("test prompt 3");
    assert.strictEqual(res3, "Fallback response to: test prompt 3");
    assert.strictEqual(primaryCallCount, 2, "Primary should NOT have been invoked because breaker is OPEN");
    assert.strictEqual(fallbackCallCount, 3);
  });
});
