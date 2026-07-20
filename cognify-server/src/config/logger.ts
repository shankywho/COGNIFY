import winston from "winston";
import { getRequestContext } from "../middleware/requestContext";

export const logger = winston.createLogger({
  level: "info",

  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      const ctx = getRequestContext();
      const reqPart = ctx?.requestId ? ` [req:${ctx.requestId}]` : "";
      const wsPart = ctx?.workspaceId ? ` [ws:${ctx.workspaceId}]` : "";
      const userPart = ctx?.userId ? ` [user:${ctx.userId}]` : "";
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      const msg = stack || message;

      return `[${timestamp}] ${level.toUpperCase()}${reqPart}${wsPart}${userPart}: ${msg}${metaStr}`;
    })
  ),

  transports: [
    new winston.transports.Console(),

    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),

    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});
