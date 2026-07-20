import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redis = env.REDIS_URL 
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : new Redis({
      host: env.REDIS_HOST || "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
  });

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message || err });
});
