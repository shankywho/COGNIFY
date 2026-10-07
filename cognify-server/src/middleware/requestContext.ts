import { Request, Response, NextFunction } from "express";
import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: string;
      workspaceId?: string;
    }
  }
}

export interface RequestContext {
  requestId: string;
  workspaceId?: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Retrieve current execution request context from AsyncLocalStorage.
 */
export const getRequestContext = (): RequestContext | undefined => {
  return requestContextStorage.getStore();
};

/**
 * Dynamically update the active request context (e.g. after auth or workspace resolution).
 */
export const updateRequestContext = (updates: Partial<RequestContext>): void => {
  const store = requestContextStorage.getStore();
  if (store) {
    if (updates.workspaceId !== undefined) store.workspaceId = updates.workspaceId;
    if (updates.userId !== undefined) store.userId = updates.userId;
    if (updates.requestId !== undefined) store.requestId = updates.requestId;
  }
};

/**
 * Middleware: captures or generates x-request-id, attaches to req.requestId and response header,
 * and binds execution to AsyncLocalStorage.
 */
export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const headerVal = req.headers["x-request-id"];
  const incomingId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const requestId = (incomingId && typeof incomingId === "string" && incomingId.trim().length > 0)
    ? incomingId.trim()
    : randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const context: RequestContext = {
    requestId,
    userId: req.userId,
    workspaceId: req.workspaceId,
  };

  requestContextStorage.run(context, () => {
    next();
  });
};
