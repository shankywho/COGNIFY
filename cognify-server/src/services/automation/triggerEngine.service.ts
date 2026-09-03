import { workflowLifecycleService } from "./workflowLifecycle.service";
import { logger } from "../../config/logger";

export const triggerEngine = {
  /** Trigger a workflow run by delegating to the unified lifecycle service */
  async triggerWorkflow(
    workflowId: string,
    trigger: "MANUAL" | "WEBHOOK" | "CRON" = "MANUAL",
    inputVariables?: Record<string, any>,
    userId?: string
  ) {
    logger.info(`Triggering workflow ${workflowId} via ${trigger}`);
    return workflowLifecycleService.dispatch({
      workflowId,
      userId: userId || "system",
      trigger,
      inputVariables,
    });
  },
};
