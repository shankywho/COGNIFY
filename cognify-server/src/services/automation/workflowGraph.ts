export interface WorkflowGraphNode {
  id: string;
  name?: string;
  type?: string;
  config?: Record<string, any>;
  [key: string]: any;
}

export interface WorkflowGraphEdge {
  source: string;
  target: string;
}

/**
 * Topologically sorts workflow nodes based on edge dependencies.
 * Trigger nodes (or nodes with in-degree 0) are prioritized first.
 * Disconnected nodes are appended at the end to guarantee full coverage.
 */
export function getOrderedNodes<T extends WorkflowGraphNode>(
  nodes: T[],
  edges: WorkflowGraphEdge[]
): T[] {
  if (!nodes || nodes.length === 0) return [];
  if (!edges || edges.length === 0) {
    return [...nodes].sort((a, b) => {
      const aTrig = a.type === "trigger" || a.type === "triggerNode";
      const bTrig = b.type === "trigger" || b.type === "triggerNode";
      if (aTrig && !bTrig) return -1;
      if (!aTrig && bTrig) return 1;
      return 0;
    });
  }

  const nodeMap = new Map<string, T>(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
    if (adj.has(e.source)) {
      adj.get(e.source)!.push(e.target);
    }
  }

  const queue: string[] = [];
  // Prioritize root nodes that have connections (inDegree 0 and outDegree > 0)
  // Truly disconnected nodes (inDegree 0 and outDegree 0) are appended at the end
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      const outDeg = (adj.get(id) || []).length;
      if (outDeg > 0) {
        const node = nodeMap.get(id);
        const isTrigger = node?.type === "trigger" || node?.type === "triggerNode";
        if (isTrigger) {
          queue.unshift(id);
        } else {
          queue.push(id);
        }
      }
    }
  }

  // If no root has outDegree > 0 (all isolated), seed queue with all inDegree 0
  if (queue.length === 0) {
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        const node = nodeMap.get(id);
        const isTrigger = node?.type === "trigger" || node?.type === "triggerNode";
        if (isTrigger) {
          queue.unshift(id);
        } else {
          queue.push(id);
        }
      }
    }
  }

  const ordered: T[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodeMap.get(currentId);
    if (node) ordered.push(node);

    for (const targetId of adj.get(currentId) || []) {
      const newDeg = (inDegree.get(targetId) || 1) - 1;
      inDegree.set(targetId, newDeg);
      if (newDeg === 0) {
        queue.push(targetId);
      }
    }
  }

  // If any disconnected or cycle-fallback nodes remain, append them
  if (ordered.length < nodes.length) {
    for (const n of nodes) {
      if (!ordered.some((o) => o.id === n.id)) {
        ordered.push(n);
      }
    }
  }

  return ordered;
}
