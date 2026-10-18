import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getOrderedNodes, WorkflowGraphNode, WorkflowGraphEdge } from "../src/services/automation/workflowGraph";

describe("WorkflowGraph - Topological Sort & DAG Execution Ordering", () => {
  test("correctly orders a linear DAG: A -> B -> C", () => {
    const nodes: WorkflowGraphNode[] = [
      { id: "node-c", name: "Slack Action", type: "action" },
      { id: "node-a", name: "Webhook Trigger", type: "trigger" },
      { id: "node-b", name: "LLM Agent", type: "ai" },
    ];

    const edges: WorkflowGraphEdge[] = [
      { source: "node-a", target: "node-b" },
      { source: "node-b", target: "node-c" },
    ];

    const ordered = getOrderedNodes(nodes, edges);
    const orderedIds = ordered.map((n) => n.id);

    assert.deepStrictEqual(orderedIds, ["node-a", "node-b", "node-c"]);
  });

  test("correctly orders a diamond/branching DAG: A -> [B, C] -> D", () => {
    const nodes: WorkflowGraphNode[] = [
      { id: "D", name: "End" },
      { id: "B", name: "Branch 1" },
      { id: "C", name: "Branch 2" },
      { id: "A", name: "Start", type: "trigger" },
    ];

    const edges: WorkflowGraphEdge[] = [
      { source: "A", target: "B" },
      { source: "A", target: "C" },
      { source: "B", target: "D" },
      { source: "C", target: "D" },
    ];

    const ordered = getOrderedNodes(nodes, edges);
    const orderedIds = ordered.map((n) => n.id);

    // 'A' must be first
    assert.strictEqual(orderedIds[0], "A");
    // 'D' must be last
    assert.strictEqual(orderedIds[3], "D");
    // 'B' and 'C' must be in between
    assert.ok(orderedIds.indexOf("B") > 0 && orderedIds.indexOf("B") < 3);
    assert.ok(orderedIds.indexOf("C") > 0 && orderedIds.indexOf("C") < 3);
  });

  test("prioritizes trigger nodes first among nodes with in-degree 0", () => {
    const nodes: WorkflowGraphNode[] = [
      { id: "helper-node", name: "Independent Helper", type: "transform" },
      { id: "trigger-node", name: "Primary Inbound Trigger", type: "trigger" },
    ];

    const edges: WorkflowGraphEdge[] = [];

    const ordered = getOrderedNodes(nodes, edges);
    assert.strictEqual(ordered[0].id, "trigger-node");
    assert.strictEqual(ordered[1].id, "helper-node");
  });

  test("preserves disconnected / isolated nodes without dropping them", () => {
    const nodes: WorkflowGraphNode[] = [
      { id: "n1", name: "Connected 1", type: "trigger" },
      { id: "n2", name: "Connected 2", type: "action" },
      { id: "n-disconnected", name: "Unconnected Note Node", type: "transform" },
    ];

    const edges: WorkflowGraphEdge[] = [{ source: "n1", target: "n2" }];

    const ordered = getOrderedNodes(nodes, edges);
    assert.strictEqual(ordered.length, 3);
    assert.strictEqual(ordered[0].id, "n1");
    assert.strictEqual(ordered[1].id, "n2");
    assert.strictEqual(ordered[2].id, "n-disconnected");
  });

  test("handles empty node arrays and empty edge lists gracefully", () => {
    assert.deepStrictEqual(getOrderedNodes([], []), []);
    const single = [{ id: "solo", name: "Solo" }];
    assert.deepStrictEqual(getOrderedNodes(single, []), single);
  });
});
