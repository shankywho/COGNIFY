import { Worker } from "bullmq";
import { logger } from "../config/logger";

const activeWorkers: Set<Worker> = new Set();

/**
 * Registers an active BullMQ worker for lifecycle management.
 */
export const registerWorker = (worker: Worker): Worker => {
  activeWorkers.add(worker);
  return worker;
};

/**
 * Gracefully closes all active BullMQ workers, allowing in-flight jobs to finish.
 */
export const closeAllWorkers = async (): Promise<void> => {
  if (activeWorkers.size === 0) return;

  logger.info(`Closing ${activeWorkers.size} active BullMQ worker(s)...`);
  const closePromises = Array.from(activeWorkers).map(async (worker) => {
    try {
      await worker.close();
      logger.info(`BullMQ worker for queue [${worker.name}] closed successfully.`);
    } catch (err: any) {
      logger.warn(`Error closing BullMQ worker for [${worker.name}]: ${err.message || err}`);
    }
  });

  await Promise.all(closePromises);
  activeWorkers.clear();
};

/**
 * Dynamically loads and initializes all BullMQ background workers (ai, workflow, docIngest).
 */
export const initAllWorkers = async (): Promise<void> => {
  logger.info("Initializing BullMQ background workers...");
  await import("./workers/ai.worker");
  await import("./workers/workflow.worker");
  await import("./workers/docIngest.worker");
  logger.info(`Registered ${activeWorkers.size} BullMQ worker(s) successfully.`);
};

export const getActiveWorkersCount = (): number => activeWorkers.size;
