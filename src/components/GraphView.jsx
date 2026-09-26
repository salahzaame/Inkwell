import { useMemo, useRef, useState } from 'react';
import { extractTags, extractWikiNames } from '../markdown.jsx';
import { applyGraphPositions, clampGraphPosition } from '../graph-layout.js';

/** Build the vault graph from real content in a deterministic 0–100 coordinate space. */
function buildGraph(files, docs) {
  const notes = files.filter(f => !f.folder);
  const byName = new Map(notes.map(n => [n.name, n]));
  const nodes = notes.map(n => ({ id: n.id, label: n.name, tag: false }));
  const edgeSet = new Set();
  const edges = [];
  const addEdge = (a, b) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (a !== b && !edgeSet.has(key)) { edgeSet.add(key); edges.push([a, b]); }
  };

  const inbound = {};
  for (const note of notes) {
    for (const name of extractWikiNames(docs[note.id] || '')) {
      const target = byName.get(name);
      if (target) { addEdge(note.id, target.id); inbound[target.id] = (inbound[target.id] || 0) + 1; }
    }
  }
  const tagNodes = new Map();
  for (const note of notes) {
    for (const tag of extractTags(docs[note.id] || '')) {
      const id = `tag:${tag}`;
      if (!tagNodes.has(id)) tagNodes.set(id, { id, label: tag, tag: true });
      addEdge(note.id, id);
    }
  }
  nodes.push(...tagNodes.values());

  const maxIn = Math.max(0, ...Object.values(inbound));
  for (const node of nodes) {
    if (node.tag) { node.r = 7; continue; }
    const count = inbound[node.id] || 0;
    node.r = Math.min(24, 10 + count * 4);
    node.acc = maxIn > 0 && count === maxIn;
  }

  const pos = {};
  nodes.forEach((node, index) => {
    const angle = index * 2.39996;
    const radius = 14 + 26 * Math.sqrt((index + 0.5) / Math.max(1, nodes.length));
    pos[node.id] = [50 + radius * 1.5 * Math.cos(angle), 50 + radius * Math.sin(angle)];
  });
  for (let iteration = 0; iteration < 160; iteration++) {
    const force = {};
    nodes.forEach(node => { force[node.id] = [0, 0]; });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].id, b = nodes[j].id;
        const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1];
        const distanceSquared = Math.max(dx * dx + dy * dy, 0.05);
        const distance = Math.sqrt(distanceSquared);
        const repulsion = 420 / distanceSquared;
        force[a][0] += (dx / distance) * repulsion; force[a][1] += (dy / distance) * repulsion;
        force[b][0] -= (dx / distance) * repulsion; force[b][1] -= (dy / distance) * repulsion;
      }
    }
    for (const [a, b] of edges) {
      const dx = pos[b][0] - pos[a][0], dy = pos[b][1] - pos[a][1];
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.05;
      const pull = (distance - 26) * 0.03;
      force[a][0] += (dx / distance) * pull; force[a][1] += (dy / distance) * pull;
      force[b][0] -= (dx / distance) * pull; force[b][1] -= (dy / distance) * pull;
    }
    nodes.forEach(node => {
      force[node.id][0] += (50 - pos[node.id][0]) * 0.012;
      force[node.id][1] += (50 - pos[node.id][1]) * 0.016;
    });
    const step = 0.9 * (1 - iteration / 170);
    nodes.forEach(node => {
      pos[node.id][0] += Math.max(-4, Math.min(4, force[node.id][0])) * step;
      pos[node.id][1] += Math.max(-4, Math.min(4, force[node.id][1])) * step;
    });
  }
  nodes.forEach(node => {
    node.x = Math.max(10, Math.min(90, pos[node.id][0]));
    node.y = Math.max(14, Math.min(84, pos[node.id][1]));
  });
  return { nodes, edges, noteCount: notes.length, tagCount: tagNodes.size };
}

export default function GraphView({ files, docs, onOpen, positions, onPositionsChange, onResetPositions }) {
  const graph = useMemo(() => buildGraph(files, docs), [files, docs]);
  const nodes = useMemo(() => applyGraphPositions(graph.nodes, positions), [graph.nodes, positions]);
  const byId = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const [dragPosition, setDragPosition] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const displayNodes = dragPosition
    ? nodes.map(node => node.id === dragPosition.id ? { ...node, ...dragPosition } : node)
    : nodes;
  const displayById = dragPosition ? new Map(displayNodes.map(node => [node.id, node])) : byId;

  const positionFromPointer = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return clampGraphPosition({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (drag && dragPosition) {
      onPositionsChange?.(previous => ({ ...previous, [drag.id]: { x: dragPosition.x, y: dragPosition.y } }));
    }
    dragRef.current = null;
    setDraggingId(null);
    setDragPosition(null);
  };

  return (
    <div
      ref={canvasRef}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, touchAction: 'none' }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const position = positionFromPointer(event);
        if (!position) return;
        if (Math.abs(position.x - drag.start.x) > 0.4 || Math.abs(position.y - drag.start.y) > 0.4) movedRef.current = true;
        setDragPosition({ id: drag.id, ...position });
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div style={{ position: 'absolute', top: '18px', left: '24px', zIndex: 2, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Graph</div>
          <div style={{ fontSize: '12px', color: '#5b6170', marginTop: '2px' }}>
            {graph.noteCount} notes · {graph.tagCount} tags — drag nodes to arrange them; click a note to open it
          </div>
        </div>
        <button className="ghost-btn" onClick={onResetPositions} style={{ fontSize: '11px', padding: '5px 8px' }}>Reset layout</button>
      </div>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
        {graph.edges.map(([a, b]) => {
          const start = displayById.get(a);
          const end = displayById.get(b);
          if (!start || !end) return null;
          return <line key={`${a}-${b}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#363b46" strokeWidth="0.22" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {displayNodes.map((node) => (
        <div
          key={node.id}
          className="g-node"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            movedRef.current = false;
            dragRef.current = { id: node.id, start: { x: node.x, y: node.y } };
            setDraggingId(node.id);
            setDragPosition({ id: node.id, x: node.x, y: node.y });
          }}
          onClick={() => {
            if (movedRef.current) { movedRef.current = false; return; }
            if (!node.tag) onOpen(node.id);
          }}
          style={{
            position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, width: `${node.r}px`, height: `${node.r}px`,
            transform: 'translate(-50%, -50%)', cursor: draggingId === node.id ? 'grabbing' : 'grab', zIndex: 1,
          }}
          aria-label={`${node.label}${node.tag ? ' tag' : ' note'}`}
        >
          <span style={{
            display: 'block', width: '100%', height: '100%', borderRadius: '50%',
            background: node.acc ? 'var(--acc)' : (node.tag ? 'transparent' : '#4a4f5c'),
            border: node.tag ? '1.5px dashed #5b6170' : 'none',
            boxShadow: node.acc ? '0 0 24px color-mix(in oklab, var(--acc) 55%, transparent)' : 'none',
          }} />
          <span style={{
            position: 'absolute', top: 'calc(100% + 7px)', left: '50%', transform: 'translateX(-50%)',
            fontSize: node.acc ? '13px' : '11.5px', fontWeight: node.acc ? 600 : 400,
            color: node.tag ? '#5b6170' : (node.acc ? '#dadde5' : '#8b90a0'), whiteSpace: 'nowrap',
            fontFamily: node.tag ? "'Gochi Hand'" : 'inherit', pointerEvents: 'none',
          }}>{node.label}</span>
        </div>
      ))}
    </div>
  );
}
