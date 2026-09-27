import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { redis } from "../config/redis";
import { logger } from "../config/logger";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  name: string;
  keyGenerator: (req: Request) => string;
}

/**
 * Atomic Lua script for sliding-window rate limiting in Redis.
 *
 * KEYS[1]: Redis sorted set key
 * ARGV[1]: windowMs (in milliseconds)
 * ARGV[2]: max (maximum allowed requests)
 * ARGV[3]: now (current timestamp in milliseconds)
 * ARGV[4]: clearBefore (timestamp cutoff for sliding window)
 * ARGV[5]: nonce (Node-generated unique request member string)
 *
 * Returns: { allowed (1 or 0), currentCount, retryAfterSeconds }
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local max = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local clearBefore = tonumber(ARGV[4])
local nonce = ARGV[5]

-- 1. Remove expired entries outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- 2. Count current elements in window
local currentCount = redis.call('ZCARD', key)

if currentCount >= max then
    -- Find oldest timestamp in current window
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldestTimestamp = tonumber(oldest[2]) or clearBefore
    local retryAfterMs = (oldestTimestamp + windowMs) - now
    if retryAfterMs < 1000 then
        retryAfterMs = 1000
    end
    local retryAfterSeconds = math.ceil(retryAfterMs / 1000)
    return {0, currentCount, retryAfterSeconds}
else
    -- 3. Add current request timestamp with Node-generated nonce and reset TTL
    redis.call('ZADD', key, now, nonce)
    redis.call('PEXPIRE', key, windowMs)
    return {1, currentCount + 1, 0}
end
`;

/**
 * Creates a Redis-backed sliding-window rate limiter using an atomic Lua script.
 * Eliminates TOCTOU race conditions under high-concurrency bursts.
 * Gracefully falls back / fails open with a warning log if Redis is momentarily unreachable.
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, max, keyPrefix, name, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    let keyIdentifier: string;
    try {
      keyIdentifier = keyGenerator(req);
    } catch {
      keyIdentifier = req.ip || "unknown";
    }

    const key = `${keyPrefix}:${keyIdentifier}`;
    const now = Date.now();
    const clearBefore = now - windowMs;
    const nonce = `${now}:${crypto.randomUUID()}`;

    try {
      // Execute the atomic Lua script in a single network roundtrip
      const result = (await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        key,
        windowMs.toString(),
        max.toString(),
        now.toString(),
        clearBefore.toString(),
        nonce
      )) as [number, number, number];

      const [allowed, currentCount, retryAfterSeconds] = result;

      if (allowed === 0) {
        res.setHeader("RateLimit-Limit", max.toString());
        res.setHeader("RateLimit-Remaining", "0");
        res.setHeader("Retry-After", retryAfterSeconds.toString());
        res.setHeader("X-RateLimit-Limit", max.toString());
        res.setHeader("X-RateLimit-Remaining", "0");
        res.setHeader("X-RateLimit-Reset", Math.ceil((now + retryAfterSeconds * 1000) / 1000).toString());

        logger.warn(`Rate limit exceeded for [${name}] key=${keyIdentifier} (current=${currentCount}, max=${max})`);

        return res.status(429).json({
          error: "Too Many Requests",
          message: `Rate limit exceeded for ${name}. Please retry after ${retryAfterSeconds} seconds.`,
          retryAfter: retryAfterSeconds,
          limit: max,
        });
      }

      const remaining = Math.max(0, max - currentCount);
      res.setHeader("RateLimit-Limit", max.toString());
      res.setHeader("RateLimit-Remaining", remaining.toString());
      res.setHeader("X-RateLimit-Limit", max.toString());
      res.setHeader("X-RateLimit-Remaining", remaining.toString());

      next();
    } catch (err: any) {
      // Graceful degradation: fail open with a warning if Redis is down
      logger.warn(`Redis rate limiter [${name}] unreachable, failing open: ${err.message || err}`);
      next();
    }
  };
};

/**
 * Helper to extract client IP behind proxies or direct connection.
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || req.ip || "127.0.0.1";
};

/**
 * Helper to extract workspace scope (from context, params, query, or body).
 */
const getWorkspaceScope = (req: Request): string => {
  return (
    req.workspaceId ||
    (req.params.workspaceId as string) ||
    (req.params.workspace_id as string) ||
    (req.query.workspace_id as string) ||
    (req.body?.workspaceId as string) ||
    (req.body?.workspace_id as string) ||
    req.userId ||
    getClientIp(req)
  );
};

// Public Limiter (IP-based, strict for auth and unauthenticated routes: 60 req/min)
export const publicLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: "rl:public",
  name: "PublicLimiter",
  keyGenerator: (req) => getClientIp(req),
});

// Workspace Read Limiter (Workspace-scoped, generous for dashboard reads: 1200 req/min)
export const workspaceReadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1200,
  keyPrefix: "rl:ws:read",
  name: "WorkspaceReadLimiter",
  keyGenerator: (req) => getWorkspaceScope(req),
});

// Workflow Trigger Limiter (Workspace-scoped, strict for expensive LLM triggers: 30 req/min)
export const workflowTriggerLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: "rl:ws:trigger",
  name: "WorkflowTriggerLimiter",
  keyGenerator: (req) => getWorkspaceScope(req),
});

// AI Streaming Limiter (Workspace-scoped: 200 req/min)
export const aiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  keyPrefix: "rl:ai",
  name: "AIRateLimiter",
  keyGenerator: (req) => getWorkspaceScope(req),
});

// Standard API Limiter (Workspace-scoped: 1000 req/min)
export const standardRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  keyPrefix: "rl:standard",
  name: "StandardRateLimiter",
  keyGenerator: (req) => getWorkspaceScope(req),
});

// Auth Route Limiter (IP-based: 100 req/15min)
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyPrefix: "rl:auth",
  name: "AuthRateLimiter",
  keyGenerator: (req) => getClientIp(req),
});
