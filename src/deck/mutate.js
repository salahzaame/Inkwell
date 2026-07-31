/**
 * Move one deck element among its immediate siblings. The deck is intentionally
 * mutated because callers work on a cloned draft inside their state updater.
 */
export function moveDeckElement(spec, key, direction) {
  if (!spec?.elements?.[key] || !Number.isInteger(direction) || direction === 0) return false;
  const parent = Object.values(spec.elements).find(element => Array.isArray(element.children) && element.children.includes(key));
  if (!parent) return false;
  const index = parent.children.indexOf(key);
  const target = index + direction;
  if (target < 0 || target >= parent.children.length) return false;
  [parent.children[index], parent.children[target]] = [parent.children[target], parent.children[index]];
  return true;
}

/** Whether a deck element can be moved in the requested direction. */
export function canMoveDeckElement(spec, key, direction) {
  if (!spec?.elements?.[key] || !Number.isInteger(direction) || direction === 0) return false;
  const parent = Object.values(spec.elements).find(element => Array.isArray(element.children) && element.children.includes(key));
  if (!parent) return false;
  const target = parent.children.indexOf(key) + direction;
  return target >= 0 && target < parent.children.length;
}
