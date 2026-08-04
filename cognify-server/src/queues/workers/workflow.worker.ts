import { Worker, Job } from "bullmq";
import { redis } from "../../config/redis";
import { prisma } from "../../config/db";
import { stepExecutor, WorkflowNode } from "../../services/automation/stepExecutor.service";
import { getOrderedNodes } from "../../services/automation/workflowGraph";
import { creditLedgerService } from "../../services/billing/creditLedger.service";
import { runEventsService } from "../../services/realtime/runEvents.service";
import { logger } from "../../config/logger";
import { WORKFLOW_EXEC_QUEUE_NAME, WorkflowJobData } from "../workflowQueue";
import { registerWorker } from "../workerRegistry";
import { handleWorkflowTerminalFailure } from "../workflowDlq";
import { requestContextStorage } from "../../middleware/requestContext";

const worker = new Worker<WorkflowJobData>(
  WORKFLOW_EXEC_QUEUE_NAME,
  async (job: Job<WorkflowJobData>) => {
    const { workflowId, runId, inputVariables, userId, workspaceId, requestId } = job.data;
    const correlationId = requestId || `job-${job.id}`;

    return requestContextStorage.run(
      {
        requestId: correlationId,
        workspaceId,
        userId,
      },
      async () => {
        logger.info(`Starting background workflow run. Run ID: ${runId}`);

        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
        });

        if (!workflow) {
          throw new Error(`Workflow ${workflowId} not found`);
        }

        // State Machine: PENDING -> RUNNING
        await prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: "RUNNING",
            startedAt: new Date(),
          },
        });

        // Telemetry: Publish run:started
        await runEventsService.publish({
          type: "run:started",
          runId,
          workflowId,
          workspaceId,
          status: "RUNNING",
        });

        const definition = workflow.definition as {
          nodes?: WorkflowNode[];
          edges?: { source: string; target: string }[];
        };

        const rawNodes = definition.nodes || [];
        const edges = definition.edges || [];
        const orderedNodes = getOrderedNodes(rawNodes, edges);

        if (orderedNodes.length === 0) {
          throw new Error("No nodes found in workflow definition");
        }

        // Fetch pre-existing steps (e.g. SKIPPED steps created during step replay)
        const existingSteps = await prisma.runStep.findMany({
          where: { runId },
        });
        const stepMap = new Map(existingSteps.map((s) => [s.nodeId, s]));

        const runLogs: any[] = [];
        const start = Date.now();
        let totalPromptTokens = 0;
        let totalCompletionTokens = 0;

        let currentInput =
          inputVariables?.message ||
          inputVariables?.webhookPayload?.message ||
          (typeof inputVariables === "string"
            ? inputVariables
            : inputVariables && Object.keys(inputVariables).length > 0
            ? JSON.stringify(inputVariables)
            : "Triggered workflow execution context");

        try {
          for (const node of orderedNodes) {
            const existingStep = stepMap.get(node.id);

            // Step-Level Replay: Check if node was pre-populated with SKIPPED cache
            if (existingStep && existingStep.status === "SKIPPED") {
              logger.info(`Replay cache hit: Skipping node [${node.id}] "${node.name}"`);
              const cachedOutput = existingStep.outputJson;
              if (cachedOutput !== null && cachedOutput !== undefined) {
                if (typeof cachedOutput === "string") {
                  currentInput = cachedOutput;
                } else if (typeof cachedOutput === "object" && (cachedOutput as any).output !== undefined) {
                  currentInput = String((cachedOutput as any).output);
                } else {
                  currentInput = JSON.stringify(cachedOutput);
                }
              }

              runLogs.push({
                nodeId: node.id,
                stepName: node.name,
                status: "SKIPPED",
                output: cachedOutput,
                replayed: true,
              });

              // Telemetry: publish replayed/cached step
              await runEventsService.publish({
                type: "step:completed",
                runId,
                workflowId,
                workspaceId,
                nodeId: node.id,
                nodeType: node.type,
                status: "SKIPPED",
                outputJson: cachedOutput,
                latencyMs: 0,
              });
              continue;
            }

            // Normal Execution: Create or update RunStep in RUNNING state
            const stepAttempt = (job.attemptsMade || 0) + 1;
            const inputPayload =
              typeof currentInput === "object" ? currentInput : { input: currentInput };

            let stepRecord = existingStep;
            if (!stepRecord) {
              stepRecord = await prisma.runStep.create({
                data: {
                  runId,
                  nodeId: node.id,
                  nodeType: node.type,
                  status: "RUNNING",
                  inputJson: inputPayload,
                  attempt: stepAttempt,
                  startedAt: new Date(),
                },
              });
            } else {
              stepRecord = await prisma.runStep.update({
                where: { id: stepRecord.id },
                data: {
                  status: "RUNNING",
                  inputJson: inputPayload,
                  attempt: stepAttempt,
                  startedAt: new Date(),
                },
              });
            }

            // Telemetry: publish step:started
            await runEventsService.publish({
              type: "step:started",
              runId,
              workflowId,
              workspaceId,
              nodeId: node.id,
              nodeType: node.type,
              attempt: stepAttempt,
              inputJson: inputPayload,
              status: "RUNNING",
            });

            const stepStart = Date.now();
            try {
              const stepResult = await stepExecutor.executeStep(
                node,
                currentInput,
                userId || "",
                workspaceId
              );

              const stepLatency = Date.now() - stepStart;
              const pTokens = stepResult.promptTokens || 0;
              const cTokens = stepResult.completionTokens || 0;
              totalPromptTokens += pTokens;
              totalCompletionTokens += cTokens;

              await prisma.runStep.update({
                where: { id: stepRecord.id },
                data: {
                  status: "COMPLETED",
                  outputJson: stepResult.outputJson ?? { output: stepResult.output },
                  latencyMs: stepLatency,
                  promptTokens: pTokens,
                  completionTokens: cTokens,
                  completedAt: new Date(),
                },
              });

              runLogs.push({
                nodeId: node.id,
                stepName: node.name,
                status: "COMPLETED",
                output: stepResult.outputJson || stepResult.output,
                latencyMs: stepLatency,
              });

              // Telemetry: publish step:completed
              await runEventsService.publish({
                type: "step:completed",
                runId,
                workflowId,
                workspaceId,
                nodeId: node.id,
                nodeType: node.type,
                status: "COMPLETED",
                outputJson: stepResult.outputJson ?? { output: stepResult.output },
                latencyMs: stepLatency,
                promptTokens: pTokens,
                completionTokens: cTokens,
              });

              currentInput = stepResult.output;
            } catch (stepErr: any) {
              const stepLatency = Date.now() - stepStart;
              await prisma.runStep.update({
                where: { id: stepRecord.id },
                data: {
                  status: "FAILED",
                  error: stepErr.message || "Step execution failed",
                  latencyMs: stepLatency,
                  completedAt: new Date(),
                },
              });

              runLogs.push({
                nodeId: node.id,
                stepName: node.name,
                status: "FAILED",
                error: stepErr.message || "Step execution failed",
                latencyMs: stepLatency,
              });

              // Telemetry: publish step:failed
              await runEventsService.publish({
                type: "step:failed",
                runId,
                workflowId,
                workspaceId,
                nodeId: node.id,
                nodeType: node.type,
                status: "FAILED",
                error: stepErr.message || "Step execution failed",
                latencyMs: stepLatency,
              });

              throw stepErr;
            }
          }

          // State Machine: Transition WorkflowRun to COMPLETED
          const latency = Date.now() - start;
          const totalTokens = totalPromptTokens + totalCompletionTokens;
          const totalCostUsd = ((totalPromptTokens * 0.0015) + (totalCompletionTokens * 0.002)) / 1000;

          await prisma.workflowRun.update({
            where: { id: runId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              latency_ms: latency,
              totalTokens,
              totalCostUsd,
              logs: runLogs as any,
            },
          });

          // Ledger: Settle credits (release reservation & commit actual tokens)
          const reservedAmount = job.data.reservedCredits ?? 100;
          const actualCredits = Math.max(1, Math.ceil(totalTokens / 10));
          await creditLedgerService.settleRunCredits(
            workspaceId,
            runId,
            reservedAmount,
            actualCredits
          );

          // Telemetry: publish run:completed
          await runEventsService.publish({
            type: "run:completed",
            runId,
            workflowId,
            workspaceId,
            status: "COMPLETED",
            latencyMs: latency,
            totalTokens,
            totalCostUsd,
          });

          logger.info(`Workflow run ${runId} completed successfully in ${latency}ms`);
        } catch (err: any) {
          const latency = Date.now() - start;
          const totalTokens = totalPromptTokens + totalCompletionTokens;
          const totalCostUsd = ((totalPromptTokens * 0.0015) + (totalCompletionTokens * 0.002)) / 1000;

          // State Machine: Transition WorkflowRun to FAILED
          await prisma.workflowRun.update({
            where: { id: runId },
            data: {
              status: "FAILED",
              completedAt: new Date(),
              error: err.message || "Execution error",
              latency_ms: latency,
              totalTokens,
              totalCostUsd,
              logs: runLogs as any,
            },
          });

          // Ledger: Refund full reservation on run failure
          const reservedAmount = job.data.reservedCredits ?? 100;
          await creditLedgerService.refundReservation(workspaceId, runId, reservedAmount);

          // Telemetry: publish run:failed
          await runEventsService.publish({
            type: "run:failed",
            runId,
            workflowId,
            workspaceId,
            status: "FAILED",
            error: err.message || "Execution error",
            latencyMs: latency,
            totalTokens,
            totalCostUsd,
          });

          logger.error(`Workflow run ${runId} failed: ${err.message}`);
          throw err;
        }
      }
    );
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

registerWorker(worker);

worker.on("completed", (job) => {
  logger.info(`Job ${job.id} for run ${job.data?.runId} completed successfully`);
});

worker.on("failed", async (job, err) => {
  logger.error(`Job ${job?.id} failed with error: ${err.message}`);
  if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
    await handleWorkflowTerminalFailure(job, err);
  }
});

export default worker;
