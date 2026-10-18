import { test, describe, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { runEventsService, RUN_EVENTS_CHANNEL } from "../src/services/realtime/runEvents.service";
import { redis } from "../src/config/redis";

describe("RunEventsService - Distributed Monotonic Sequence Numbers via Redis", () => {
  let originalIncr: any;
  let originalExpire: any;
  let originalPublish: any;

  beforeEach(() => {
    originalIncr = redis.incr;
    originalExpire = redis.expire;
    originalPublish = redis.publish;
  });

  afterEach(() => {
    redis.incr = originalIncr;
    redis.expire = originalExpire;
    redis.publish = originalPublish;
  });

  after(() => {
    redis.disconnect();
  });

  test("increments distributed sequence counter and sets 1-hour TTL on initial event", async () => {
    let incrKeyCalled: string | null = null;
    let expireKeyCalled: string | null = null;
    let expireTtlCalled: number | null = null;
    let publishedChannel: string | null = null;
    let publishedMessage: any = null;

    redis.incr = (async (key: string) => {
      incrKeyCalled = key;
      return 1; // First event
    }) as any;

    redis.expire = (async (key: string, ttl: number) => {
      expireKeyCalled = key;
      expireTtlCalled = ttl;
      return 1;
    }) as any;

    redis.publish = (async (channel: string, message: string) => {
      publishedChannel = channel;
      publishedMessage = JSON.parse(message);
      return 1;
    }) as any;

    const payload = await runEventsService.publish({
      type: "step:started",
      runId: "run-dist-001",
      workflowId: "wf-100",
      workspaceId: "ws-100",
      nodeId: "node-1",
      status: "RUNNING",
    });

    assert.strictEqual(incrKeyCalled, "run:seq:run-dist-001");
    assert.strictEqual(expireKeyCalled, "run:seq:run-dist-001");
    assert.strictEqual(expireTtlCalled, 3600);
    assert.strictEqual(payload.seq, 1);
    assert.strictEqual(publishedChannel, RUN_EVENTS_CHANNEL);
    assert.strictEqual(publishedMessage.seq, 1);
    assert.strictEqual(publishedMessage.runId, "run-dist-001");
  });

  test("subsequent events increment sequence without resetting TTL", async () => {
    let expireCalled = false;

    redis.incr = (async () => {
      return 4; // 4th event in run
    }) as any;

    redis.expire = (async () => {
      expireCalled = true;
      return 1;
    }) as any;

    redis.publish = (async () => 1) as any;

    const payload = await runEventsService.publish({
      type: "step:completed",
      runId: "run-dist-001",
      workflowId: "wf-100",
      workspaceId: "ws-100",
      nodeId: "node-1",
      status: "COMPLETED",
    });

    assert.strictEqual(payload.seq, 4);
    assert.strictEqual(expireCalled, false, "Must not re-call expire on subsequent steps");
  });
});
