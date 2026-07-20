import dotenv from "dotenv";

dotenv.config();

import * as Sentry from "@sentry/node";
import { env } from "./config/env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { redis } from "./config/redis";
import { prisma } from "./config/db";
import { closeAllWorkers, initAllWorkers, getActiveWorkersCount } from "./queues/workerRegistry";

import app from "./app";
import { logger } from "./config/logger";
import { registerChatSocket } from "./sockets/chat.socket";
import { initRunEventsSubscriber } from "./services/realtime/runEvents.service";

const PORT = env.PORT;
const SERVICE_ROLE = (process.env.SERVICE_ROLE || "all").toLowerCase();

let server: http.Server | null = null;
let healthServer: http.Server | null = null;
let io: Server | null = null;
let adapterPubClient: any = null;
let adapterSubClient: any = null;
let runEventsSub: any = null;

async function bootstrap() {
  logger.info(`Starting Cognify service with SERVICE_ROLE=${SERVICE_ROLE}...`);

  // API role: HTTP endpoints, WebSockets, and Redis Pub/Sub run telemetry fanout
  if (SERVICE_ROLE === "api" || SERVICE_ROLE === "all") {
    server = http.createServer(app);

    io = new Server(server, {
      cors: {
        origin: "*",
      },
    });

    // Multi-Pod Socket.io Fan-Out via Redis Adapter
    adapterPubClient = redis.duplicate();
    adapterSubClient = redis.duplicate();
    io.adapter(createAdapter(adapterPubClient, adapterSubClient));
    logger.info("Attached Redis adapter to Socket.io for multi-pod fan-out.");

    // Initialize Redis Pub/Sub run telemetry fanout to Socket.io rooms
    runEventsSub = initRunEventsSubscriber(io);

    io.on("connection", (socket) => {
      registerChatSocket(io!, socket);
    });

    server.listen(PORT, () => {
      logger.info(`Cognify API server (${SERVICE_ROLE}) running on port ${PORT}`);
    });
  }

  // Worker role: BullMQ queue consumers and lightweight HTTP health probe
  if (SERVICE_ROLE === "worker" || SERVICE_ROLE === "all") {
    await initAllWorkers();

    // In dedicated worker mode, run a lightweight health server on PORT for container health probes
    if (SERVICE_ROLE === "worker") {
      healthServer = http.createServer((req, res) => {
        if (req.url === "/health" || req.url === "/") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "healthy",
              role: "worker",
              activeWorkers: getActiveWorkersCount(),
              timestamp: new Date().toISOString(),
            })
          );
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      healthServer.listen(PORT, () => {
        logger.info(`Cognify Worker health probe running on port ${PORT}`);
      });
    }
  }
}

bootstrap().catch((err) => {
  logger.error("Failed to bootstrap Cognify service:", err);
  process.exit(1);
});

// Graceful shutdown sequence ensuring in-flight connections and queue jobs drain cleanly
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
    return;
  }
  isShuttingDown = true;
  logger.info(`Received ${signal}. Initiating graceful shutdown (SERVICE_ROLE=${SERVICE_ROLE})...`);

  // Force exit safety timeout: terminate process after 15s if hung
  const forceExitTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 15 seconds. Forcing process exit.");
    process.exit(1);
  }, 15000);
  forceExitTimeout.unref();

  try {
    // 1. Close active WebSocket connections and Redis adapter clients
    if (io) {
      await new Promise<void>((resolve) => {
        io!.close(() => {
          logger.info("Socket.io connections closed.");
          resolve();
        });
      });
    }

    if (adapterPubClient && adapterSubClient) {
      await Promise.all([
        adapterPubClient.quit().catch(() => adapterPubClient.disconnect()),
        adapterSubClient.quit().catch(() => adapterSubClient.disconnect()),
      ]);
      logger.info("Socket.io Redis adapter clients closed cleanly.");
    }

    // 2. Stop accepting incoming HTTP connections & drain in-flight requests
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => {
          if (err) {
            logger.error("Error closing HTTP server:", err);
            return reject(err);
          }
          logger.info("HTTP API server closed. In-flight requests drained.");
          resolve();
        });
      });
    }

    // 3. Close worker health server if running
    if (healthServer) {
      await new Promise<void>((resolve) => {
        healthServer!.close(() => {
          logger.info("Worker health probe closed.");
          resolve();
        });
      });
    }

    // 4. Gracefully close all BullMQ background workers if registered
    if (SERVICE_ROLE === "worker" || SERVICE_ROLE === "all") {
      await closeAllWorkers();
    }

    // 5. Drain and disconnect Redis run events subscriber and main client
    try {
      if (runEventsSub) {
        await runEventsSub.quit().catch(() => runEventsSub.disconnect());
      }
      if (redis.status === "ready" || redis.status === "connecting") {
        await redis.quit();
        logger.info("Redis main client disconnected cleanly.");
      }
    } catch (redisErr: any) {
      logger.warn(`Error disconnecting Redis cleanly: ${redisErr.message}`);
      redis.disconnect();
    }

    // 6. Disconnect Prisma ORM database connection pool
    await prisma.$disconnect();
    logger.info("Prisma database connection pool closed cleanly.");

    clearTimeout(forceExitTimeout);
    logger.info("Graceful shutdown completed successfully. Exiting.");
    process.exit(0);
  } catch (err: any) {
    logger.error(`Error during graceful shutdown: ${err.message || err}`, { stack: err.stack });
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason: any) => {
  logger.error("Unhandled Promise Rejection:", { reason: reason?.message || reason, stack: reason?.stack });
});

process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught Exception:", { message: err.message, stack: err.stack });
  shutdown("uncaughtException");
});
