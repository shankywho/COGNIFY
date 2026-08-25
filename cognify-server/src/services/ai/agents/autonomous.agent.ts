import { vectorMemoryService } from "../vectorMemory.service";
import { toolRegistry } from "../tools/toolRegistry";
import { llmGateway } from "../circuitBreaker";
import { logger } from "../../../config/logger";

export type AgentType = "code" | "research" | "business" | "analytics" | "general";

export interface AgentStep {
  thought: string;
  action?: string;
  observation?: any;
}

export interface AgentExecutionResult {
  response: string;
  steps: AgentStep[];
  agentType: AgentType;
}

const PERSONA_PROMPTS: Record<AgentType, string> = {
  code: `You are an expert software engineer and code assistant.
Your job is to:
- Write clean, production-ready code with clear types
- Debug issues and explain root causes concisely
- Review code for correctness, performance, and security
- Suggest architectural and refactoring improvements
- Always provide working, complete code snippets`,

  research: `You are an expert researcher and technical synthesizer.
Your job is to:
- Summarize complex engineering and scientific topics with precision
- Structure answers logically with structured markdown headers
- Highlight key trade-offs, empirical evidence, and takeaways
- Synthesize multiple perspectives objectively`,

  business: `You are an expert SaaS strategist and startup operations advisor.
Your job is to:
- Provide actionable go-to-market and growth strategy
- Analyze business models, pricing tiers, and unit economics
- Formulate value propositions and customer communication
- Keep recommendations pragmatic and metric-driven`,

  analytics: `You are an expert data analyst and business intelligence engineer.
Your job is to:
- Interpret telemetry metrics, KPIs, and statistical trends
- Identify performance bottlenecks, regressions, and anomalies
- Recommend concrete, data-informed action items
- Format numerical comparisons in clear markdown tables`,

  general: `You are an intelligent, helpful AI assistant.
Provide clear, direct, and well-structured technical responses.`,
};

/**
 * Deep AgentEngine Module.
 * Consolidates intent classification, persona prompting, tool execution,
 * workspace memory injection, and fault-tolerant LLM gateway routing behind
 * a single small execute interface.
 */
export const autonomousAgent = {
  /**
   * Deterministically classifies user input into a specialized agent persona.
   */
  detectAgentType(input: string): AgentType {
    const lower = input.toLowerCase();

    if (
      lower.includes("code") ||
      lower.includes("bug") ||
      lower.includes("function") ||
      lower.includes("debug") ||
      lower.includes("implement") ||
      lower.includes("refactor") ||
      lower.includes("typescript") ||
      lower.includes("javascript") ||
      lower.includes("python") ||
      lower.includes("api") ||
      lower.includes("database") ||
      lower.includes("sql")
    ) {
      return "code";
    }

    if (
      lower.includes("research") ||
      lower.includes("summarize") ||
      lower.includes("explain") ||
      lower.includes("what is") ||
      lower.includes("how does") ||
      lower.includes("compare") ||
      lower.includes("study")
    ) {
      return "research";
    }

    if (
      lower.includes("business") ||
      lower.includes("marketing") ||
      lower.includes("startup") ||
      lower.includes("strategy") ||
      lower.includes("revenue") ||
      lower.includes("pricing") ||
      lower.includes("customer")
    ) {
      return "business";
    }

    if (
      lower.includes("analytics") ||
      lower.includes("metric") ||
      lower.includes("trend") ||
      lower.includes("data") ||
      lower.includes("report") ||
      lower.includes("latency") ||
      lower.includes("throughput")
    ) {
      return "analytics";
    }

    return "general";
  },

  /**
   * Executes a task across intent classification, context retrieval, tool invocation, and LLM generation.
   */
  async run(
    input: string,
    userId: string,
    workspaceId?: string,
    forcedAgentType?: string
  ): Promise<AgentExecutionResult> {
    const steps: AgentStep[] = [];

    // 1. Detect or apply agent persona
    const validTypes: AgentType[] = ["code", "research", "business", "analytics", "general"];
    const agentType: AgentType = (validTypes.includes(forcedAgentType as any)
      ? forcedAgentType
      : this.detectAgentType(input)) as AgentType;

    steps.push({ thought: `Selected agent persona: ${agentType}` });

    // 2. Build grounded vector memory context if workspace is specified
    let context = "";
    if (workspaceId) {
      try {
        context = await vectorMemoryService.buildContext(workspaceId, input);
        if (context) {
          steps.push({ thought: "Injected relevant workspace memory context" });
        }
      } catch (err: any) {
        logger.warn(`Failed to retrieve vector memory context: ${err.message || err}`);
      }
    }

    // 3. Inspect and execute internal tools if requested
    const lower = input.toLowerCase();
    if (lower.includes("workspace") && toolRegistry.get_workspaces) {
      try {
        const tool = toolRegistry.get_workspaces;
        const result = await tool.execute({ userId });
        steps.push({
          thought: `Executed tool: ${tool.name}`,
          action: tool.name,
          observation: result,
        });

        const prompt = `${PERSONA_PROMPTS[agentType]}

${context ? `Workspace Memory:\n${context}\n` : ""}Tool Observation (${tool.name}):
${JSON.stringify(result, null, 2)}

User Request:
${input}`;

        const response = await llmGateway.generate(prompt);
        return { steps, response, agentType };
      } catch (toolErr: any) {
        logger.warn(`Tool execution error: ${toolErr.message || toolErr}`);
      }
    }

    // 4. Synthesize final contextualized prompt and dispatch through LLM gateway
    const systemPersona = PERSONA_PROMPTS[agentType] || PERSONA_PROMPTS.general;
    const finalPrompt = `${systemPersona}

${context ? `Workspace Context:\n${context}\n` : ""}User Request:
${input}`;

    const response = await llmGateway.generate(finalPrompt);

    return { steps, response, agentType };
  },
};
