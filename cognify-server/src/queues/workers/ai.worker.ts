import { Worker } from "bullmq";
import { redis } from "../../config/redis";
import { registerWorker } from "../workerRegistry";
import { logger } from "../../config/logger";

const worker = new Worker(
  "ai-processing",
  async (job) => {
    logger.info(`Processing AI job: ${job.id}`, { data: job.data });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { success: true };
  },
  {
    connection: redis,
  }
);

registerWorker(worker);

worker.on("completed", (job) => {
  logger.info(`BullMQ AI job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  logger.error(`BullMQ AI job ${job?.id} failed`, { error: err.message || err });
});