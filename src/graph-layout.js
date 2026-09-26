export const GRAPH_BOUNDS = { minX: 4, maxX: 96, minY: 10, maxY: 90 };

export function clampGraphPosition(position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  return {
    x: Math.max(GRAPH_BOUNDS.minX, Math.min(GRAPH_BOUNDS.maxX, position.x)),
    y: Math.max(GRAPH_BOUNDS.minY, Math.min(GRAPH_BOUNDS.maxY, position.y)),
  };
}

export function applyGraphPositions(nodes, positions = {}) {
  return nodes.map((node) => {
    const position = clampGraphPosition(positions[node.id]);
    return position ? { ...node, ...position } : node;
  });
}
