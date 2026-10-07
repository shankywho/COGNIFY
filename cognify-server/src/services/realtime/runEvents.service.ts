import { Server } from "socket.io";
import { redis } from "../../config/redis";
import { logger } from "../../config/logger";

export const RUN_EVENTS_CHANNEL = "cognify:run-events";

export type RunEventType =
  | "run:started"
  | "step:started"
  | "step:completed"
  | "step:failed"
  | "run:completed"
  | "run:failed";

export interface RunTelemetryEvent {
  type: RunEventType;
  runId: string;
  workflowId: string;
  workspaceId: string;
  nodeId?: string;
  nodeType?: string;
  attempt?: number;
  status?: string;
  inputJson?: any;
  outputJson?: any;
  error?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  totalCostUsd?: number;
  timestamp: string;
  seq: number;
}

export const runEventsService = {
  /**
   * Publishes a telemetry event to Redis Pub/Sub with a distributed atomic monotonic sequence number.
   * Leverages Redis INCR and 1-hour TTL to ensure strictly increasing ordering across horizontally scaled worker pods.
   */
  async publish(
    event: Omit<RunTelemetryEvent, "timestamp" | "seq">
  ): Promise<RunTelemetryEvent> {
    const seqKey = `run:seq:${event.runId}`;
    let seq = 1;

    try {
      seq = await redis.incr(seqKey);
      if (seq === 1) {
        await redis.expire(seqKey, 3600);
      }
    } catch (redisErr: any) {
      logger.warn(`Failed to increment distributed run sequence in Redis for ${event.runId}: ${redisErr.message}`);
    }

    const payload: RunTelemetryEvent = {
      ...event,
      seq,
      timestamp: new Date().toISOString(),
    };

    try {
      await redis.publish(RUN_EVENTS_CHANNEL, JSON.stringify(payload));
    } catch (err: any) {
      logger.error(`Failed to publish run event to Redis: ${err.message}`);
    }

    return payload;
  },
};

/**
 * Initializes Redis Pub/Sub subscriber and fans out run events to Socket.io rooms.
 * Rooms:
 *   - run:${runId}
 *   - workspace:${workspaceId}
 */
export function initRunEventsSubscriber(io: Server) {
  const subscriber = redis.duplicate();

  subscriber.subscribe(RUN_EVENTS_CHANNEL, (err, count) => {
    if (err) {
      logger.error(
        `Failed to subscribe to ${RUN_EVENTS_CHANNEL}: ${err.message}`
      );
    } else {
      logger.info(
        `Subscribed to Redis Pub/Sub ${RUN_EVENTS_CHANNEL} (active channels: ${count})`
      );
    }
  });

  subscriber.on("message", (channel, message) => {
    if (channel !== RUN_EVENTS_CHANNEL) return;

    try {
      const event: RunTelemetryEvent = JSON.parse(message);
      // Fan out to specific run room
      io.to(`run:${event.runId}`).emit(event.type, event);
      // Fan out to workspace room
      io.to(`workspace:${event.workspaceId}`).emit(event.type, event);
      io.to(event.workspaceId).emit(event.type, event);
    } catch (parseErr: any) {
      logger.error(
        `Error parsing/broadcasting run event from Redis: ${parseErr.message}`
      );
    }
  });

  return subscriber;
}
