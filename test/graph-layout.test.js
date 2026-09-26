import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGraphPositions, clampGraphPosition } from '../src/graph-layout.js';

test('clamps dragged graph nodes to the usable canvas', () => {
  assert.deepEqual(clampGraphPosition({ x: -20, y: 110 }), { x: 4, y: 90 });
  assert.equal(clampGraphPosition({ x: '50', y: 30 }), null);
});

test('overlays saved positions without disturbing unpositioned nodes', () => {
  const nodes = [{ id: 'a', x: 30, y: 40 }, { id: 'b', x: 60, y: 70 }];
  const positioned = applyGraphPositions(nodes, { a: { x: 78, y: 21 } });
  assert.deepEqual(positioned, [{ id: 'a', x: 78, y: 21 }, { id: 'b', x: 60, y: 70 }]);
});
