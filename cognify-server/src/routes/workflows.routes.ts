import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { workspaceAccess, hasWorkspaceAccess } from "../middleware/workspaceAccess.middleware";
import { workflowTriggerLimiter } from "../middleware/rateLimiter";
import { prisma } from "../config/db";
import {
  workflowLifecycleService,
  ServiceOverloadedError,
  WorkflowNotFoundError,
  NodeNotFoundError,
} from "../services/automation/workflowLifecycle.service";
import { InsufficientCreditsError } from "../services/billing/creditLedger.service";
import { logger } from "../config/logger";

const router = Router();

/** GET /api/workflows/:workspaceId — List all workflows in a workspace */
router.get(
  "/:workspaceId",
  authMiddleware,
  workspaceAccess,
  async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const workflows = await prisma.workflow.findMany({
        where: { workspace_id: workspaceId },
        orderBy: { created_at: "desc" },
      });
      res.json(workflows);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** POST /api/workflows/:workspaceId — Create a new workflow in a workspace */
router.post(
  "/:workspaceId",
  authMiddleware,
  workspaceAccess,
  async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const userId = (req as any).userId;
      const { name, description, definition } = req.body;

      if (!name) return res.status(400).json({ message: "Workflow name is required" });

      const workflow = await prisma.workflow.create({
        data: {
          name,
          description,
          definition: definition || { nodes: [], edges: [] },
          workspace_id: workspaceId,
          user_id: userId,
        },
      });

      res.status(201).json(workflow);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** PUT /api/workflows/:id — Update a workflow definition or status */
router.put(
  "/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).userId;
      const { name, description, isActive, definition } = req.body;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      const updatedWorkflow = await prisma.workflow.update({
        where: { id },
        data: {
          name: name !== undefined ? name : undefined,
          description: description !== undefined ? description : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          definition: definition !== undefined ? definition : undefined,
        },
      });

      res.json(updatedWorkflow);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** DELETE /api/workflows/:id — Delete a workflow */
router.delete(
  "/:id",
  authMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).userId;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      await prisma.workflowRun.deleteMany({
        where: { workflowId: id },
      });

      await prisma.workflow.delete({
        where: { id },
      });

      res.json({ message: "Workflow deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/**
 * POST /api/workflows/:id/run — Idempotent trigger of a workflow run
 * Delegates to deep WorkflowLifecycle module for backpressure, idempotency, and credit holds.
 */
router.post(
  "/:id/run",
  authMiddleware,
  workflowTriggerLimiter,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).userId;
      const idempotencyKey = (req.headers["idempotency-key"] || req.headers["x-idempotency-key"]) as string | undefined;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      const result = await workflowLifecycleService.dispatch({
        workflowId: id,
        userId,
        trigger: "MANUAL",
        inputVariables: req.body.inputVariables || {},
        idempotencyKey,
        requestId: req.requestId,
      });

      if (result.duplicate) {
        return res.status(200).json(result);
      }
      return res.status(202).json(result);
    } catch (err: any) {
      if (err instanceof ServiceOverloadedError) {
        res.setHeader("Retry-After", String(err.retryAfter));
        return res.status(503).json({
          error: "Service Overloaded",
          queueDepth: err.queueDepth,
          maxQueueDepth: err.maxQueueDepth,
        });
      }
      if (err instanceof InsufficientCreditsError || err.statusCode === 402) {
        return res.status(402).json({
          error: "Payment Required",
          message: err.message,
          required: err.required,
          available: err.available,
        });
      }
      if (err instanceof WorkflowNotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

/**
 * POST /api/workflows/:id/runs/:runId/replay — Step-level replay of a prior workflow run
 * Accepts { fromNodeId: string } in body.
 * Pre-populates upstream completed steps as SKIPPED so earlier work isn't re-executed or re-billed.
 */
router.post(
  "/:id/runs/:runId/replay",
  authMiddleware,
  workflowTriggerLimiter,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const runId = req.params.runId as string;
      const userId = (req as any).userId;
      const { fromNodeId } = req.body;

      if (!fromNodeId) {
        return res.status(400).json({ message: "fromNodeId is required for step-level replay" });
      }

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      const result = await workflowLifecycleService.replay({
        workflowId: id,
        runId,
        userId,
        fromNodeId,
        inputVariables: req.body.inputVariables || {},
        requestId: req.requestId,
      });

      return res.status(202).json({
        newRunId: result.runId,
        status: result.status,
        replayedFrom: result.replayedFrom,
        cachedStepsCount: result.cachedStepsCount,
      });
    } catch (err: any) {
      if (err instanceof ServiceOverloadedError) {
        res.setHeader("Retry-After", String(err.retryAfter));
        return res.status(503).json({
          error: "Service Overloaded",
          queueDepth: err.queueDepth,
          maxQueueDepth: err.maxQueueDepth,
        });
      }
      if (err instanceof InsufficientCreditsError || err.statusCode === 402) {
        return res.status(402).json({
          error: "Payment Required",
          message: err.message,
          required: err.required,
          available: err.available,
        });
      }
      if (err instanceof WorkflowNotFoundError) {
        return res.status(404).json({ message: err.message });
      }
      if (err instanceof NodeNotFoundError) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

/** POST /api/workflows/:id/trigger — Manually trigger a workflow run (legacy endpoint) */
router.post(
  "/:id/trigger",
  authMiddleware,
  workflowTriggerLimiter,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).userId;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      const result = await workflowLifecycleService.dispatch({
        workflowId: id,
        userId,
        trigger: "MANUAL",
        inputVariables: req.body.inputVariables,
      });

      res.json({ message: "Workflow triggered successfully", runId: result.runId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** GET /api/workflows/:id/runs — Fetch execution runs history for a workflow */
router.get(
  "/:id/runs",
  authMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const userId = (req as any).userId;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      const runs = await prisma.workflowRun.findMany({
        where: { workflowId: id },
        include: {
          steps: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      res.json(runs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** GET /api/workflows/:id/runs/:runId — Fetch details of a single workflow run including its steps */
router.get(
  "/:id/runs/:runId",
  authMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const runId = req.params.runId as string;
      const userId = (req as any).userId;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });
      if (!workflow) return res.status(404).json({ message: "Workflow not found" });

      const hasAccess = await hasWorkspaceAccess(workflow.workspace_id, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this workspace" });
      }

      const run = await prisma.workflowRun.findUnique({
        where: { id: runId },
        include: {
          steps: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!run) return res.status(404).json({ message: "Workflow run not found" });

      res.json(run);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

/** POST /api/workflows/webhook/:id — External webhook endpoint to trigger workflow */
router.post(
  "/webhook/:id",
  async (req, res) => {
    try {
      const id = req.params.id as string;
      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });

      if (!workflow) return res.status(404).json({ message: "Workflow not found" });
      if (!workflow.isActive) return res.status(400).json({ message: "Workflow is inactive" });

      const result = await workflowLifecycleService.dispatch({
        workflowId: id,
        userId: workflow.user_id,
        trigger: "WEBHOOK",
        inputVariables: {
          webhookPayload: req.body,
          headers: req.headers,
        },
      });

      res.json({ message: "Webhook received and workflow queued", runId: result.runId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
