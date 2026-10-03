// The vault tree: projects, folders and notes in one flat list, nested by
// `parent`. Kept free of React so the rules (what may move where, what a
// delete takes with it) are tested on their own.
//
//   project  a top-level research project (folder: true, kind: 'project')
//   folder   a folder anywhere, inside a project or not (folder: true)
//   note     anything else

const isProject = (file) => file?.folder && file.kind === 'project';

// natural order: "Chapter 2" before "Chapter 10"
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const byEdited = (a, b) => (b.mtime || 0) - (a.mtime || 0) || byName(a, b);

/** Children of each parent id (null for the root), unknown parents treated as root. */
function childrenByParent(files) {
  const known = new Set(files.map(file => file.id));
  const byParent = new Map();
  for (const file of files) {
    const parent = file.parent && known.has(file.parent) ? file.parent : null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(file);
  }
  return byParent;
}

/**
 * Visible rows in tree order with a depth for indentation. Projects come
 * first, then folders, then notes; each group by name or by last edit.
 */
export function vaultRows(files = [], collapsed = {}, { sort = 'name' } = {}) {
  const byParent = childrenByParent(files);
  const rank = (file) => (isProject(file) ? 0 : file.folder ? 1 : 2);
  const within = sort === 'edited' ? byEdited : byName;
  const order = (a, b) => rank(a) - rank(b) || (a.folder && b.folder ? byName(a, b) : within(a, b));
  const rows = [];
  const visit = (parent, depth) => {
    for (const file of [...(byParent.get(parent) || [])].sort(order)) {
      rows.push({ file, depth });
      if (file.folder && !collapsed[file.id]) visit(file.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** Every id inside a folder, however deep (not the folder itself). */
export function descendantIds(files = [], id) {
  const byParent = childrenByParent(files);
  const out = [];
  const visit = (parent) => {
    for (const child of byParent.get(parent) || []) {
      out.push(child.id);
      if (child.folder) visit(child.id);
    }
  };
  visit(id);
  return out;
}

/**
 * Whether `id` may move into `parent` (null: the vault root). Never into
 * itself or anything inside it, only into folders, and a project stays a
 * top-level project.
 */
export function canMoveInto(files = [], id, parent = null) {
  const item = files.find(file => file.id === id);
  if (!item) return false;
  if ((item.parent || null) === (parent || null)) return false; // already there
  if (!parent) return true;
  if (isProject(item)) return false;
  const target = files.find(file => file.id === parent);
  if (!target?.folder || parent === id) return false;
  return !descendantIds(files, id).includes(parent);
}

/** Folders `id` could move into, in tree order with depth, for a "Move to" list. */
export function moveDestinations(files = [], id) {
  return vaultRows(files.filter(file => file.folder), {})
    .filter(({ file }) => canMoveInto(files, id, file.id));
}

/** Names from the top of the tree down to `id`: ['Thesis', 'Methods']. */
export function folderPath(files = [], id) {
  const byId = new Map(files.map(file => [file.id, file]));
  const out = [];
  const seen = new Set();
  for (let at = byId.get(id); at && !seen.has(at.id); at = byId.get(at.parent)) {
    seen.add(at.id);
    out.unshift(at.name);
  }
  return out;
}

/** Pick a readable sibling name without overwriting an existing project, folder, or note. */
export function uniqueVaultName(files = [], base = 'Untitled', parent = null, exceptId = null) {
  const clean = String(base).trim() || 'Untitled';
  const occupied = new Set(files
    .filter(file => file.id !== exceptId && (file.parent || null) === (parent || null))
    .map(file => file.name.toLowerCase()));
  if (!occupied.has(clean.toLowerCase())) return clean;
  let count = 2;
  while (occupied.has(`${clean} ${count}`.toLowerCase())) count += 1;
  return `${clean} ${count}`;
}

/** Move one item while preserving all other vault metadata. */
export function moveVaultItem(files = [], id, parent = null) {
  return files.map(file => file.id === id ? { ...file, parent: parent || undefined, top: !parent, mtime: Date.now() } : file);
}

/** The folders and overview note a new research project can start with. */
export const PROJECT_STARTER = {
  folders: ['Literature', 'Methods', 'Writing'],
  overview: (name) => `# ${name}\n\n## Question\n\n\n## Why it matters\n\n\n## Plan\n\n- [ ] \n\n## Open threads\n\n`,
};
