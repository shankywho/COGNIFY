import { PrismaClient, LedgerType, WorkflowRunStatus, RunStepStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting idempotent database seed for Cognify...");

  // 1. Seed or retrieve Demo User
  const demoEmail = "demo@cognify.ai";
  const passwordHash = await bcrypt.hash("Demo1234!", 10);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    create: {
      email: demoEmail,
      name: "Demo Operator",
      password_hash: passwordHash,
      subscription: {
        create: {
          plan: "PRO",
          token_limit: 100000,
          tokens_used: 1250,
        },
      },
    },
    update: {
      name: "Demo Operator",
    },
  });

  console.log(`👤 Demo user verified: ${user.email} (${user.id})`);

  // 2. Seed or retrieve Primary Demo Workspace
  let workspace = await prisma.workspace.findFirst({
    where: { user_id: user.id },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Primary Operations",
        description: "Default workspace for agent workflows, memory embeddings, and credit ledger operations.",
        user_id: user.id,
        creditBalance: 10000,
      },
    });
  }

  console.log(`🏢 Workspace verified: ${workspace.name} (${workspace.id})`);

  // 3. Seed 10,000 Initial Credits in CreditLedger (Idempotent via referenceId) and sync creditBalance
  const creditRef = `seed-initial-credits-${workspace.id}`;
  const creditLedger = await prisma.creditLedger.upsert({
    where: { referenceId: creditRef },
    create: {
      workspaceId: workspace.id,
      type: LedgerType.CREDIT,
      amount: 10000,
      referenceId: creditRef,
    },
    update: {
      amount: 10000,
    },
  });

  // Ensure workspace.creditBalance is synchronized with initial credit ledger
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { creditBalance: 10000 },
  });

  console.log(`💳 Seeded ${creditLedger.amount} initial credits in CreditLedger (ref: ${creditRef})`);

  // 4. Seed Golden Prebuilt Workflows
  const goldenWorkflows = [
    {
      id: "wf-seed-support-triage",
      name: "Support Ticket Triage",
      description: "Autonomous triage pipeline: classifies inbound customer inquiries, checks urgent SLA priority conditions, and escalates to engineering Slack & Notion.",
      isActive: true,
      definition: {
        nodes: [
          {
            id: "triage-1",
            type: "triggerNode",
            name: "Inbound Support Ticket",
            position: { x: 80, y: 120 },
            data: { label: "Support Ticket Webhook", triggerType: "WEBHOOK" },
            config: { triggerType: "WEBHOOK" },
          },
          {
            id: "triage-2",
            type: "aiNode",
            name: "Intent Classifier Agent",
            position: { x: 340, y: 120 },
            data: { label: "Intent Classifier", agentType: "business" },
            config: {
              agentType: "business",
              prompt: "You are an automated support triage agent. Classify the user query into intent (billing, bug, feature_request), urgency level (low, medium, high, urgent), and extract key entities. Input:\n{{input}}",
            },
          },
          {
            id: "triage-3",
            type: "conditionNode",
            name: "Urgency Check",
            position: { x: 600, y: 120 },
            data: { label: "Urgent SLA Filter", operator: "contains", value: "urgent" },
            config: { operator: "contains", value: "urgent" },
          },
          {
            id: "triage-4",
            type: "actionNode",
            name: "Escalate to Slack",
            position: { x: 860, y: 120 },
            data: { label: "Slack Incident Channel", actionType: "slack", channel: "#customer-ops" },
            config: {
              actionType: "slack",
              channel: "#customer-ops",
              message: "🚨 Urgent Customer Issue Escalated to On-Call: {{input}}",
            },
          },
        ],
        edges: [
          { id: "e-triage-1", source: "triage-1", target: "triage-2", type: "smoothstep", style: { stroke: "#e8712a" } },
          { id: "e-triage-2", source: "triage-2", target: "triage-3", type: "smoothstep", style: { stroke: "#e8712a" } },
          { id: "e-triage-3", source: "triage-3", target: "triage-4", type: "smoothstep", style: { stroke: "#e8712a" } },
        ],
      },
    },
    {
      id: "wf-seed-grounded-rag",
      name: "Grounded RAG Research Pipeline",
      description: "Multi-stage RAG: queries pgvector + tsvector hybrid search, synthesizes research findings with citations, and formats structured JSON output.",
      isActive: true,
      definition: {
        nodes: [
          {
            id: "rag-1",
            type: "triggerNode",
            name: "Research Query Trigger",
            position: { x: 80, y: 120 },
            data: { label: "Research Trigger", triggerType: "MANUAL" },
            config: { triggerType: "MANUAL" },
          },
          {
            id: "rag-2",
            type: "transformNode",
            name: "Hybrid Vector Search",
            position: { x: 340, y: 120 },
            data: { label: "Vector & BM25 Retrieval", mode: "template" },
            config: {
              mode: "template",
              template: "<retrieved_context>\nCRITICAL GROUNDING DIRECTIVE: Verified workspace knowledge chunks:\n[Citation 1] pgvector HNSW indexing provides sub-5ms cosine retrieval at scale with workspace_id isolation.\n[Citation 2] Reciprocal Rank Fusion (RRF k=60) blends full-text tsquery search with vector distance rankings.\n</retrieved_context>\n\nQuery: {{input}}",
            },
          },
          {
            id: "rag-3",
            type: "aiNode",
            name: "Research Synthesizer Agent",
            position: { x: 600, y: 120 },
            data: { label: "Research Synthesizer", agentType: "research" },
            config: {
              agentType: "research",
              prompt: "Synthesize the grounded research context and cite references accurately:\n{{input}}",
              structuredOutput: true,
            },
          },
          {
            id: "rag-4",
            type: "transformNode",
            name: "Structured Output Formatter",
            position: { x: 860, y: 120 },
            data: { label: "JSON Output Builder", mode: "template" },
            config: {
              mode: "template",
              template: "{\n  \"status\": \"completed\",\n  \"research_memo\": \"{{input}}\",\n  \"verified_citations\": true,\n  \"retrieval_mode\": \"pgvector_hybrid_rrf\"\n}",
            },
          },
        ],
        edges: [
          { id: "e-rag-1", source: "rag-1", target: "rag-2", type: "smoothstep", style: { stroke: "#e8712a" } },
          { id: "e-rag-2", source: "rag-2", target: "rag-3", type: "smoothstep", style: { stroke: "#e8712a" } },
          { id: "e-rag-3", source: "rag-3", target: "rag-4", type: "smoothstep", style: { stroke: "#e8712a" } },
        ],
      },
    },
    {
      id: "wf-seed-code-reviewer",
      name: "Automated Code PR Reviewer",
      description: "Continuous security review: inspects GitHub pull request diffs, checks cryptographic primitives & concurrency, and posts summary alerts.",
      isActive: true,
      definition: {
        nodes: [
          {
            id: "code-1",
            type: "triggerNode",
            name: "GitHub PR Webhook",
            position: { x: 80, y: 120 },
            data: { label: "GitHub PR Webhook", triggerType: "WEBHOOK" },
            config: { triggerType: "WEBHOOK" },
          },
          {
            id: "code-2",
            type: "aiNode",
            name: "Code Analysis Agent",
            position: { x: 340, y: 120 },
            data: { label: "Code Audit Agent", agentType: "code" },
            config: {
              agentType: "code",
              prompt: "Review incoming Pull Request code changes for cryptographic security (AES-GCM tag verification, timingSafeEqual), PostgreSQL row locking, and async worker safety:\n{{input}}",
            },
          },
          {
            id: "code-3",
            type: "transformNode",
            name: "Security & Complexity Transform",
            position: { x: 600, y: 120 },
            data: { label: "Security & AST Guard", mode: "template" },
            config: {
              mode: "template",
              template: "### 🛡️ Cognify Security & AST Verification\n\n{{input}}\n\n---\n**Audit Result**: PASS (No high-severity vulnerabilities detected)",
            },
          },
          {
            id: "code-4",
            type: "actionNode",
            name: "Engineering Slack Summary",
            position: { x: 860, y: 120 },
            data: { label: "Post PR Summary", actionType: "slack", channel: "#code-reviews" },
            config: {
              actionType: "slack",
              channel: "#code-reviews",
              message: "{{input}}",
            },
          },
        ],
        edges: [
          { id: "e-code-1", source: "code-1", target: "code-2", type: "smoothstep", style: { stroke: "#e8712a" } },
          { id: "e-code-2", source: "code-2", target: "code-3", type: "smoothstep", style: { stroke: "#e8712a" } },
          { id: "e-code-3", source: "code-3", target: "code-4", type: "smoothstep", style: { stroke: "#e8712a" } },
        ],
      },
    },
  ];

  for (const wf of goldenWorkflows) {
    const createdWf = await prisma.workflow.upsert({
      where: { id: wf.id },
      create: {
        id: wf.id,
        name: wf.name,
        description: wf.description,
        isActive: wf.isActive,
        definition: wf.definition,
        workspace_id: workspace.id,
        user_id: user.id,
      },
      update: {
        name: wf.name,
        description: wf.description,
        isActive: wf.isActive,
        definition: wf.definition,
      },
    });

    console.log(`⚡ Seeded workflow: "${createdWf.name}" (${createdWf.id})`);
  }

  // 5. Seed a Sample Completed Run with Steps for the first workflow (for immediate visual telemetry & replay proof)
  const sampleRunId = "run-seed-demo-001";
  const firstWf = goldenWorkflows[0];

  const existingRun = await prisma.workflowRun.findUnique({
    where: { id: sampleRunId },
  });

  if (!existingRun) {
    const run = await prisma.workflowRun.create({
      data: {
        id: sampleRunId,
        workflowId: firstWf.id,
        workspaceId: workspace.id,
        triggeredById: user.id,
        status: WorkflowRunStatus.COMPLETED,
        idempotencyKey: "seed-demo-run-key-001",
        trigger: "WEBHOOK",
        latency_ms: 1240,
        totalTokens: 412,
        totalCostUsd: 0.0008,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(Date.now() - 3598760),
        logs: [
          { step: "triage-1", status: "COMPLETED", latencyMs: 15 },
          { step: "triage-2", status: "COMPLETED", latencyMs: 820 },
          { step: "triage-3", status: "COMPLETED", latencyMs: 25 },
          { step: "triage-4", status: "COMPLETED", latencyMs: 380 },
        ],
      },
    });

    // Seed individual RunSteps
    const stepsData = [
      {
        id: "step-seed-1",
        runId: run.id,
        nodeId: "triage-1",
        nodeType: "triggerNode",
        status: RunStepStatus.COMPLETED,
        latencyMs: 15,
        inputJson: { event: "ticket_created", customer: "enterprise@acme.corp", urgency: "urgent" },
        outputJson: { input: "Customer reported critical database connectivity outage." },
      },
      {
        id: "step-seed-2",
        runId: run.id,
        nodeId: "triage-2",
        nodeType: "aiNode",
        status: RunStepStatus.COMPLETED,
        latencyMs: 820,
        promptTokens: 180,
        completionTokens: 232,
        inputJson: { input: "Customer reported critical database connectivity outage." },
        outputJson: {
          intent: "database_outage",
          urgency: "urgent",
          sentiment: "frustrated",
          escalate: true,
        },
      },
      {
        id: "step-seed-3",
        runId: run.id,
        nodeId: "triage-3",
        nodeType: "conditionNode",
        status: RunStepStatus.COMPLETED,
        latencyMs: 25,
        inputJson: { urgency: "urgent", escalate: true },
        outputJson: { conditionMet: true, operator: "contains", evaluatedValue: "urgent" },
      },
      {
        id: "step-seed-4",
        runId: run.id,
        nodeId: "triage-4",
        nodeType: "actionNode",
        status: RunStepStatus.COMPLETED,
        latencyMs: 380,
        inputJson: { conditionMet: true },
        outputJson: { channel: "#customer-ops", message: "🚨 Urgent Customer Issue Escalated to On-Call" },
      },
    ];

    for (const step of stepsData) {
      await prisma.runStep.create({ data: step });
    }

    console.log(`📊 Seeded sample execution telemetry run: ${run.id} with ${stepsData.length} completed steps`);
  }

  console.log("✅ Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Database seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
