/** Return visible vault rows in stable tree order, with a depth for indentation. */
export function vaultRows(files = [], collapsed = {}) {
  const byParent = new Map();
  const known = new Set(files.map(file => file.id));
  for (const file of files) {
    const parent = file.parent && known.has(file.parent) ? file.parent : null;
    const entries = byParent.get(parent) || [];
    entries.push(file);
    byParent.set(parent, entries);
  }
  const rows = [];
  const visit = (parent, depth) => {
    for (const file of byParent.get(parent) || []) {
      rows.push({ file, depth });
      if (file.folder && !collapsed[file.id]) visit(file.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** Pick a readable sibling name without overwriting an existing project, folder, or note. */
export function uniqueVaultName(files = [], base = 'Untitled', parent = null) {
  const clean = String(base).trim() || 'Untitled';
  const occupied = new Set(files.filter(file => (file.parent || null) === (parent || null)).map(file => file.name.toLowerCase()));
  if (!occupied.has(clean.toLowerCase())) return clean;
  let count = 2;
  while (occupied.has(`${clean} ${count}`.toLowerCase())) count += 1;
  return `${clean} ${count}`;
}

/** Move one item while preserving all other vault metadata. */
export function moveVaultItem(files = [], id, parent = null) {
  return files.map(file => file.id === id ? { ...file, parent: parent || undefined, top: !parent, mtime: Date.now() } : file);
}
