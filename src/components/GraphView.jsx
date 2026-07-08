import { useMemo } from 'react';
import { extractTags, extractWikiNames } from '../markdown.jsx';

/**
 * Build the vault graph from real content: notes are nodes, [[wikilinks]] are edges,
 * #tags become dashed satellite nodes. Layout is a small deterministic force simulation
 * in a 0–100 % coordinate space.
 */
function buildGraph(files, docs) {
  const notes = files.filter(f => !f.folder);
  const byName = new Map(notes.map(n => [n.name, n]));
  const nodes = notes.map(n => ({ id: n.id, label: n.name, tag: false }));
  const edgeSet = new Set();
  const edges = [];
  const addEdge = (a, b) => {
    const k = a < b ? a + '|' + b : b + '|' + a;
    if (a !== b && !edgeSet.has(k)) { edgeSet.add(k); edges.push([a, b]); }
  };

  const inbound = {};
  for (const n of notes) {
    for (const name of extractWikiNames(docs[n.id] || '')) {
      const t = byName.get(name);
      if (t) { addEdge(n.id, t.id); inbound[t.id] = (inbound[t.id] || 0) + 1; }
    }
  }
  const tagNodes = new Map();
  for (const n of notes) {
    for (const tag of extractTags(docs[n.id] || '')) {
      const tid = 'tag:' + tag;
      if (!tagNodes.has(tid)) tagNodes.set(tid, { id: tid, label: tag, tag: true });
      addEdge(n.id, tid);
    }
  }
  nodes.push(...tagNodes.values());

  const maxIn = Math.max(0, ...Object.values(inbound));
  for (const n of nodes) {
    if (n.tag) { n.r = 7; continue; }
    const inb = inbound[n.id] || 0;
    n.r = Math.min(24, 10 + inb * 4);
    n.acc = maxIn > 0 && inb === maxIn;
  }

  // deterministic force layout
  const pos = {};
  nodes.forEach((n, i) => {
    const a = i * 2.39996;
    const r = 14 + 26 * Math.sqrt((i + 0.5) / Math.max(1, nodes.length));
    pos[n.id] = [50 + r * 1.5 * Math.cos(a), 50 + r * Math.sin(a)];
  });
  for (let it = 0; it < 160; it++) {
    const f = {};
    nodes.forEach(n => { f[n.id] = [0, 0]; });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i].id, B = nodes[j].id;
        const dx = pos[A][0] - pos[B][0], dy = pos[A][1] - pos[B][1];
        const d2 = Math.max(dx * dx + dy * dy, 0.05);
        const d = Math.sqrt(d2);
        const rep = 420 / d2;
        f[A][0] += (dx / d) * rep; f[A][1] += (dy / d) * rep;
        f[B][0] -= (dx / d) * rep; f[B][1] -= (dy / d) * rep;
      }
    }
    for (const [a, b] of edges) {
      const dx = pos[b][0] - pos[a][0], dy = pos[b][1] - pos[a][1];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.05;
      const pull = (d - 26) * 0.03;
      f[a][0] += (dx / d) * pull; f[a][1] += (dy / d) * pull;
      f[b][0] -= (dx / d) * pull; f[b][1] -= (dy / d) * pull;
    }
    nodes.forEach(n => {
      f[n.id][0] += (50 - pos[n.id][0]) * 0.012;
      f[n.id][1] += (50 - pos[n.id][1]) * 0.016;
    });
    const step = 0.9 * (1 - it / 170);
    nodes.forEach(n => {
      pos[n.id][0] += Math.max(-4, Math.min(4, f[n.id][0])) * step;
      pos[n.id][1] += Math.max(-4, Math.min(4, f[n.id][1])) * step;
    });
  }
  nodes.forEach(n => {
    n.x = Math.max(10, Math.min(90, pos[n.id][0]));
    n.y = Math.max(14, Math.min(84, pos[n.id][1]));
  });

  return { nodes, edges, noteCount: notes.length, tagCount: tagNodes.size };
}

export default function GraphView({ files, docs, onOpen }) {
  const { nodes, edges, noteCount, tagCount } = useMemo(() => buildGraph(files, docs), [files, docs]);
  const byId = new Map(nodes.map(n => [n.id, n]));

  // edge coords map node % positions onto the 800x460 viewBox; preserveAspectRatio="none"
  // keeps the lines aligned with the %-positioned node divs at any window size
  const px = (n) => ({ X: n.x * 8, Y: n.y * 4.6 });

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ position: 'absolute', top: '18px', left: '24px', zIndex: 2 }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Graph</div>
        <div style={{ fontSize: '12px', color: '#5b6170', marginTop: '2px' }}>
          {noteCount} notes · {tagCount} tags — built from your wikilinks; click a node to open it
        </div>
      </div>
      <svg width="100%" height="100%" viewBox="0 0 800 460" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {edges.map(([a, b], i) => {
          const A = px(byId.get(a));
          const B = px(byId.get(b));
          return <line key={i} x1={A.X} y1={A.Y} x2={B.X} y2={B.Y} stroke="#2c2f37" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {nodes.map((n, i) => (
        <div
          key={n.id}
          className="g-node"
          onClick={() => !n.tag && onOpen(n.id)}
          style={{
            position: 'absolute', left: n.x + '%', top: n.y + '%', transform: 'translate(-50%,-50%)',
            cursor: n.tag ? 'default' : 'pointer',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', animation: `floatY ${5 + (i % 5) * 0.7}s ease-in-out ${(i % 7) * 0.4}s infinite` }}>
            <span style={{
              width: n.r + 'px', height: n.r + 'px', borderRadius: '50%',
              background: n.acc ? 'var(--acc)' : (n.tag ? 'transparent' : '#4a4f5c'),
              border: n.tag ? '1.5px dashed #5b6170' : 'none',
              boxShadow: n.acc ? '0 0 24px color-mix(in oklab, var(--acc) 55%, transparent)' : 'none',
            }} />
            <span style={{
              fontSize: n.acc ? '13px' : '11.5px', fontWeight: n.acc ? 600 : 400,
              color: n.tag ? '#5b6170' : (n.acc ? '#dadde5' : '#8b90a0'),
              whiteSpace: 'nowrap', fontFamily: n.tag ? "'Gochi Hand'" : 'inherit',
            }}>{n.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
