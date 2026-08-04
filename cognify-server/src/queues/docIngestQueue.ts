import { Queue } from "bullmq";
import { redis } from "../config/redis";

export interface DocIngestJobData {
  fileId: string;
  workspaceId: string;
  filePath: string;
  mimetype: string;
  requestId?: string;
}

/**
 * Dedicated queue for background document parsing, chunking, and vector embedding.
 * Keeps bulk uploads isolated from live workflow execution queues.
 */
export const docIngestQueue = new Queue<DocIngestJobData>(
  "doc-ingest",
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: { count: 200, age: 3600 }, // Max 200 parsed files or 1 hour
      removeOnFail: { count: 500, age: 86400 },    // Max 500 failures or 24 hours
    },
  }
);
