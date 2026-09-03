import { prisma } from "../../config/db";
import { workflowExecQueue } from "../../queues/workflowQueue";
import { creditLedgerService, InsufficientCreditsError } from "../billing/creditLedger.service";
import { getOrderedNodes, WorkflowGraphNode } from "./workflowGraph";
import { logger } from "../../config/logger";

export class ServiceOverloadedError extends Error {
  readonly statusCode = 503;
  readonly retryAfter = 30;
  readonly queueDepth: number;
  readonly maxQueueDepth: number;

  constructor(queueDepth: number, maxQueueDepth: number) {
    super(`Workflow execution queue is overloaded (${queueDepth} >= ${maxQueueDepth})`);
    this.name = "ServiceOverloadedError";
    this.queueDepth = queueDepth;
    this.maxQueueDepth = maxQueueDepth;
  }
}

export class WorkflowNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = "Workflow not found") {
    super(message);
    this.name = "WorkflowNotFoundError";
  }
}

export class NodeNotFoundError extends Error {
  readonly statusCode = 400;
  constructor(nodeId: string) {
    super(`Node with id "${nodeId}" not found in workflow definition`);
    this.name = "NodeNotFoundError";
  }
}

export interface DispatchWorkflowOptions {
  workflowId: string;
  userId: string;
  trigger?: "MANUAL" | "WEBHOOK" | "CRON" | "REPLAY";
  inputVariables?: Record<string, any>;
  idempotencyKey?: string;
  requestId?: string;
}

export interface ReplayWorkflowOptions {
  workflowId: string;
  runId: string;
  userId: string;
  fromNodeId: string;
  inputVariables?: Record<string, any>;
  requestId?: string;
}

export interface DispatchResult {
  runId: string;
  status: string;
  duplicate?: boolean;
  idempotencyKey?: string;
  replayedFrom?: string;
  cachedStepsCount?: number;
}

/**
 * Deep WorkflowLifecycle Module.
 * Encapsulates the entire workflow execution lifecycle behind a small, robust interface:
 * - Queue backpressure load-shedding
 * - Atomic credit holds and reservation
 * - Idempotency deduplication and P2002 race handling
 * - Directed Acyclic Graph (DAG) topological step replay caching
 * - BullMQ execution job enqueueing
 */
export const workflowLifecycleService = {
  /**
   * Dispatches a new workflow run, enforcing backpressure, idempotency, and credit holds.
   */
  async dispatch(options: DispatchWorkflowOptions): Promise<DispatchResult> {
    const {
      workflowId,
      userId,
      trigger = "MANUAL",
      inputVariables = {},
      idempotencyKey,
      requestId,
    } = options;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) {
      throw new WorkflowNotFoundError();
    }

    // 1. Idempotency Check: return existing run if key was previously dispatched
    if (idempotencyKey) {
      const existingRun = await prisma.workflowRun.findUnique({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId: workflow.workspace_id,
            idempotencyKey,
          },
        },
      });

      if (existingRun) {
        logger.info(`Idempotent hit for key "${idempotencyKey}": returning existing run ${existingRun.id}`);
        return {
          runId: existingRun.id,
          status: existingRun.status,
          idempotencyKey,
          duplicate: true,
        };
      }
    }

    // 2. Backpressure check: shed load if queue exceeds capacity
    const MAX_QUEUE_DEPTH = parseInt(process.env.MAX_QUEUE_DEPTH || "1000", 10);
    const waitingCount = await workflowExecQueue.getWaitingCount();
    if (waitingCount >= MAX_QUEUE_DEPTH) {
      logger.warn(
        `Load shedding triggered on workflow execution queue: ${waitingCount} waiting >= ${MAX_QUEUE_DEPTH}`
      );
      throw new ServiceOverloadedError(waitingCount, MAX_QUEUE_DEPTH);
    }

    // 3. Atomically reserve credits for the run (ensures workspace balance >= 100)
    const RESERVED_CREDITS = 100;
    const reserveReferenceId = idempotencyKey
      ? `reserve-${workflow.workspace_id}-${idempotencyKey}`
      : `reserve-${workflow.workspace_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    await creditLedgerService.reserveCredits(
      workflow.workspace_id,
      "pending",
      RESERVED_CREDITS,
      reserveReferenceId
    );

    // 4. Create WorkflowRun record with P2002 race recovery on unique idempotencyKey
    let run;
    try {
      run = await prisma.workflowRun.create({
        data: {
          workflowId,
          workspaceId: workflow.workspace_id,
          triggeredById: userId,
          status: "PENDING",
          idempotencyKey: idempotencyKey || null,
          trigger,
          logs: [],
        },
      });
    } catch (createErr: any) {
      if (createErr.code === "P2002" && idempotencyKey) {
        const raceRun = await prisma.workflowRun.findUnique({
          where: {
            workspaceId_idempotencyKey: {
              workspaceId: workflow.workspace_id,
              idempotencyKey,
            },
          },
        });
        if (raceRun) {
          logger.info(`Concurrent idempotency race resolved for key "${idempotencyKey}": returning existing run ${raceRun.id}`);
          return {
            runId: raceRun.id,
            status: raceRun.status,
            idempotencyKey,
            duplicate: true,
          };
        }
      }
      throw createErr;
    }

    // 5. Enqueue execution job for background worker pool
    await workflowExecQueue.add(
      "run-workflow",
      {
        workflowId,
        runId: run.id,
        trigger,
        inputVariables,
        userId,
        workspaceId: workflow.workspace_id,
        requestId,
        reservedCredits: RESERVED_CREDITS,
      }
    );

    return {
      runId: run.id,
      status: "PENDING",
    };
  },

  /**
   * Replays a prior workflow run starting from a specific node, reusing cached upstream outputs.
   */
  async replay(options: ReplayWorkflowOptions): Promise<DispatchResult> {
    const { workflowId, runId, userId, fromNodeId, inputVariables = {}, requestId } = options;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) {
      throw new WorkflowNotFoundError();
    }

    const originalRun = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        steps: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!originalRun || originalRun.workflowId !== workflowId) {
      throw new WorkflowNotFoundError("Original workflow run not found");
    }

    const definition = workflow.definition as {
      nodes?: { id: string; name: string; type: string }[];
      edges?: { source: string; target: string }[];
    };
    const rawNodes = definition.nodes || [];
    const edges = definition.edges || [];
    const orderedNodes = getOrderedNodes(rawNodes, edges);

    const targetNode = orderedNodes.find((n: WorkflowGraphNode) => n.id === fromNodeId);
    if (!targetNode) {
      throw new NodeNotFoundError(fromNodeId);
    }

    // Create new WorkflowRun record in PENDING status
    const newRun = await prisma.workflowRun.create({
      data: {
        workflowId,
        workspaceId: workflow.workspace_id,
        triggeredById: userId,
        status: "PENDING",
        trigger: "REPLAY",
        logs: [],
      },
    });

    // Populate completed steps from original run
    const completedStepMap = new Map(
      originalRun.steps
        .filter((s) => s.status === "COMPLETED")
        .map((s) => [s.nodeId, s])
    );

    const upstreamStepsToCreate = [];
    for (const node of orderedNodes) {
      if (node.id === fromNodeId) {
        break;
      }
      const prevStep = completedStepMap.get(node.id);
      if (prevStep) {
        upstreamStepsToCreate.push({
          runId: newRun.id,
          nodeId: prevStep.nodeId,
          nodeType: prevStep.nodeType,
          status: "SKIPPED" as const,
          inputJson: prevStep.inputJson as any,
          outputJson: prevStep.outputJson as any,
          attempt: 1,
          latencyMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          completedAt: new Date(),
        });
      }
    }

    if (upstreamStepsToCreate.length > 0) {
      await prisma.runStep.createMany({
        data: upstreamStepsToCreate,
      });
    }

    // Reserve discounted credits for replay
    const REPLAY_RESERVED_CREDITS = 50;
    const replayReserveRef = `reserve-replay-${newRun.id}`;
    await creditLedgerService.reserveCredits(
      workflow.workspace_id,
      newRun.id,
      REPLAY_RESERVED_CREDITS,
      replayReserveRef
    );

    await workflowExecQueue.add(
      "run-workflow",
      {
        workflowId,
        runId: newRun.id,
        trigger: "REPLAY",
        fromNodeId,
        inputVariables,
        userId,
        workspaceId: workflow.workspace_id,
        requestId,
        reservedCredits: REPLAY_RESERVED_CREDITS,
      }
    );

    return {
      runId: newRun.id,
      status: "PENDING",
      replayedFrom: fromNodeId,
      cachedStepsCount: upstreamStepsToCreate.length,
    };
  },
};
