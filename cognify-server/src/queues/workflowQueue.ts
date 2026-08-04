import { Queue } from "bullmq";
import { redis } from "../config/redis";

export interface WorkflowJobData {
  workflowId: string;
  runId: string;
  workspaceId: string;
  userId: string;
  requestId?: string;
  inputVariables?: Record<string, any>;
  trigger?: string;
  fromNodeId?: string;
  cachedOutputs?: Record<string, any>;
  reservedCredits?: number;
}

export const WORKFLOW_EXEC_QUEUE_NAME = "workflow-exec";

/**
 * Dedicated high-priority queue for interactive workflow executions.
 * Configured with exponential backoff with jitter and max 3 attempts.
 */
export const workflowExecQueue = new Queue<WorkflowJobData>(
  WORKFLOW_EXEC_QUEUE_NAME,
  {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { count: 500, age: 3600 }, // Max 500 jobs or 1 hour retention
      removeOnFail: { count: 1000, age: 86400 },   // Max 1000 jobs or 24 hours retention
    },
  }
);

/** Backward-compatible alias */
export const workflowQueue = workflowExecQueue;
