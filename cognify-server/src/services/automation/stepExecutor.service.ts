import { httpClient as axios } from "../../config/httpAgent";
import { z } from "zod";
import { actionDispatcher } from "../integrations/actionDispatcher.service";
import { autonomousAgent } from "../ai/agents/autonomous.agent";
import { estimateTokens } from "../../utils/cost";
import { logger } from "../../config/logger";

export interface WorkflowNode {
  id: string;
  name: string;
  type: "trigger" | "ai" | "action" | "condition" | "transform" | "http" | string;
  config: {
    agentType?: "code" | "research" | "business" | "analytics" | "general";
    prompt?: string;
    schema?: Record<string, any>;
    outputSchema?: Record<string, any> | string;
    structuredOutput?: boolean;
    actionType?: "slack" | "notion" | "sheets";
    channel?: string;
    message?: string;
    databaseId?: string;
    title?: string;
    content?: string;
    spreadsheetId?: string;
    range?: string;
    values?: any[];
    // Condition node properties
    operator?: "equals" | "contains" | "gt" | "lt" | "exists" | "not_equals";
    value?: any;
    field?: string;
    // Transform node properties
    template?: string;
    mode?: "template" | "json_parse" | "uppercase" | "lowercase";
    // HTTP node properties
    url?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers?: Record<string, string>;
    body?: any;
    timeoutMs?: number;
    [key: string]: any;
  };
}

export interface StepExecutionResult {
  output: string;
  outputJson?: any;
  promptTokens: number;
  completionTokens: number;
}

/** Expand variables like {{input}} inside string configurations */
function expandVariables(text: string, inputContext: string): string {
  if (!text) return "";
  return text.replace(/\{\{input\}\}/g, inputContext).replace(/\{\{context\}\}/g, inputContext);
}

/** Extract JSON string from markdown code blocks or plain text */
function extractJsonString(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1).trim();
  }
  return text.trim();
}

export const stepExecutor = {
  async executeStep(
    node: WorkflowNode,
    inputContext: string,
    userId: string,
    workspaceId: string
  ): Promise<StepExecutionResult> {
    logger.info(`Executing step node [${node.id}] "${node.name}" of type [${node.type}]`);
    const nodeType = (node.type || "").replace(/Node$/, "").toLowerCase();
    const config = { ...(node as any).data, ...(node.config || {}) };
    node.config = config;

    switch (nodeType) {
      // Trigger node
      case "trigger": {
        return {
          output: inputContext,
          outputJson: { input: inputContext },
          promptTokens: 0,
          completionTokens: 0,
        };
      }

      // Deterministic condition node
      case "condition": {
        const { operator = "contains", value, field } = node.config;
        let targetText = inputContext;

        if (field) {
          try {
            const parsed = JSON.parse(inputContext);
            targetText = parsed[field] !== undefined ? String(parsed[field]) : "";
          } catch {
            // Keep targetText as string
          }
        }

        let conditionPassed = false;
        const compareValue = value !== undefined ? String(value).toLowerCase() : "";
        const lowerTarget = targetText.toLowerCase();

        switch (operator) {
          case "equals":
            conditionPassed = lowerTarget === compareValue;
            break;
          case "not_equals":
            conditionPassed = lowerTarget !== compareValue;
            break;
          case "contains":
            conditionPassed = lowerTarget.includes(compareValue);
            break;
          case "exists":
            conditionPassed = targetText.trim().length > 0;
            break;
          case "gt":
            conditionPassed = parseFloat(targetText) > parseFloat(compareValue);
            break;
          case "lt":
            conditionPassed = parseFloat(targetText) < parseFloat(compareValue);
            break;
          default:
            conditionPassed = lowerTarget.includes(compareValue);
        }

        const resultObj = {
          conditionMet: conditionPassed,
          operator,
          evaluatedValue: targetText,
          expectedValue: value,
        };

        return {
          output: JSON.stringify(resultObj),
          outputJson: resultObj,
          promptTokens: 0,
          completionTokens: 0,
        };
      }

      // Deterministic transform node
      case "transform": {
        const { mode = "template", template } = node.config;
        let transformed = inputContext;

        if (mode === "template" && template) {
          transformed = expandVariables(template, inputContext);
        } else if (mode === "uppercase") {
          transformed = inputContext.toUpperCase();
        } else if (mode === "lowercase") {
          transformed = inputContext.toLowerCase();
        } else if (mode === "json_parse") {
          try {
            const parsed = JSON.parse(inputContext);
            return {
              output: JSON.stringify(parsed, null, 2),
              outputJson: parsed,
              promptTokens: 0,
              completionTokens: 0,
            };
          } catch (e: any) {
            throw new Error(`Failed to parse input as JSON in transform node: ${e.message}`);
          }
        }

        return {
          output: transformed,
          outputJson: { transformed },
          promptTokens: 0,
          completionTokens: 0,
        };
      }

      // Deterministic HTTP node
      case "http": {
        const { url, method = "GET", headers = {}, body, timeoutMs = 15000 } = node.config;
        if (!url) throw new Error("HTTP node requires a valid URL in config");

        const expandedUrl = expandVariables(url, inputContext);
        let requestBody = body;
        if (typeof body === "string") {
          try {
            requestBody = JSON.parse(expandVariables(body, inputContext));
          } catch {
            requestBody = expandVariables(body, inputContext);
          }
        }

        logger.info(`HTTP Node making ${method} request to ${expandedUrl}`);
        const response = await axios({
          url: expandedUrl,
          method,
          headers,
          data: requestBody,
          timeout: timeoutMs,
          validateStatus: (status) => status < 500,
        });

        const outputStr = typeof response.data === "object" ? JSON.stringify(response.data) : String(response.data);
        return {
          output: outputStr,
          outputJson: {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
          },
          promptTokens: 0,
          completionTokens: 0,
        };
      }

      // Agentic LLM node (with Zod validation & repair retry)
      case "ai":
      case "agent": {
        const { prompt, agentType, schema, outputSchema, structuredOutput } = node.config;
        const expandedPrompt = expandVariables(prompt || "{{input}}", inputContext);

        logger.info(`Running AI agent step: ${agentType || "autonomous"} (length=${expandedPrompt.length})`);
        const promptTokens = estimateTokens(expandedPrompt);

        let result = await autonomousAgent.run(expandedPrompt, userId, workspaceId, agentType);
        let completionTokens = estimateTokens(result.response);
        let parsedOutputJson: any = null;

        // Structured output verification via Zod if schema specified
        const targetSchema = outputSchema || schema;
        if (structuredOutput || targetSchema) {
          let schemaValidator: z.ZodTypeAny;

          if (targetSchema && typeof targetSchema === "object") {
            // Build dynamic Zod record or schema validator
            schemaValidator = z.record(z.string(), z.any());
          } else {
            schemaValidator = z.any();
          }

          let isValid = false;
          let jsonString = extractJsonString(result.response);

          try {
            parsedOutputJson = JSON.parse(jsonString);
            schemaValidator.parse(parsedOutputJson);
            isValid = true;
          } catch (parseErr: any) {
            logger.warn(`Agent structured output failed validation: ${parseErr.message}. Initiating repair retry prompt...`);

            // RETRY ONCE WITH A REPAIR PROMPT
            const repairPrompt = `System: Your previous response was expected to be valid JSON matching a schema, but failed validation with error: "${parseErr.message}".
User Request: ${expandedPrompt}
Previous Response:
${result.response}

Fix the output. Return ONLY a valid JSON object matching the required structure, with no markdown fences, no formatting, and no commentary.`;

            const repairResult = await autonomousAgent.run(repairPrompt, userId, workspaceId);
            completionTokens += estimateTokens(repairResult.response);

            try {
              const repairedJsonString = extractJsonString(repairResult.response);
              parsedOutputJson = JSON.parse(repairedJsonString);
              schemaValidator.parse(parsedOutputJson);
              result = repairResult;
              isValid = true;
              logger.info("Agent structured output repair retry succeeded.");
            } catch (repairErr: any) {
              logger.error(`Agent output repair retry also failed validation: ${repairErr.message}`);
              throw new Error(`LLM output failed structured JSON schema validation after repair attempt: ${repairErr.message}`);
            }
          }
        }

        return {
          output: result.response,
          outputJson: parsedOutputJson || { text: result.response },
          promptTokens,
          completionTokens,
        };
      }

      // Action integration nodes (delegated to deep ActionDispatcher with vault resolution)
      case "action": {
        const { actionType } = node.config;
        if (!actionType) {
          throw new Error("Action node missing actionType in config");
        }
        const result = await actionDispatcher.dispatch({
          actionType,
          config: node.config,
          inputContext,
          workspaceId,
        });

        return {
          output: result.output,
          outputJson: result.outputJson,
          promptTokens: 0,
          completionTokens: 0,
        };
      }

      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  },
};
