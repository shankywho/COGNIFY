import { Queue, Job } from "bullmq";
import { redis } from "../config/redis";
import { prisma } from "../config/db";
import { logger } from "../config/logger";
import { requestContextStorage } from "../middleware/requestContext";

export interface DlqJobData {
  runId: string;
  workflowId: string;
  workspaceId: string;
  requestId?: string;
  attemptsMade: number;
  error: string;
  stack?: string;
  failedAt: string;
}

/**
 * Dead-Letter Queue (DLQ) for permanently failed workflow runs.
 */
export const workflowDlq = new Queue<DlqJobData>(
  "workflow-dlq",
  {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  }
);

/**
 * Persists terminal failure details to WorkflowRun and dispatches to workflow-dlq.
 */
export const handleWorkflowTerminalFailure = async (job: Job, error: Error): Promise<void> => {
  const { runId, workflowId, workspaceId, requestId } = job.data;

  // Run in request context for correlated logging
  await requestContextStorage.run({ requestId, workspaceId }, async () => {
    logger.error(`Terminal failure for workflow run ${runId} (attempts=${job.attemptsMade}/${job.opts.attempts}): ${error.message}`);

    try {
      if (runId) {
        await prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: "FAILED",
            error: error.message || "Execution failed permanently",
            completedAt: new Date(),
          },
        });
      }

      await workflowDlq.add("terminal-failure", {
        runId,
        workflowId,
        workspaceId,
        requestId,
        attemptsMade: job.attemptsMade,
        error: error.message || "Unknown error",
        stack: error.stack,
        failedAt: new Date().toISOString(),
      });

      logger.info(`Persisted terminal failure to WorkflowRun ${runId} and enqueued to workflow-dlq.`);
    } catch (dlqErr: any) {
      logger.error(`Failed to handle terminal DLQ failure: ${dlqErr.message || dlqErr}`, { stack: dlqErr.stack });
    }
  });
};
