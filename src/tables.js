function cleanCell(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

export function tableMarkdown(header, rows) {
  const columns = header.length;
  const cell = (value) => cleanCell(value);
  return [
    `| ${header.map(cell).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${Array.from({ length: columns }, (_, index) => cell(row[index])).join(' | ')} |`),
  ].join('\n');
}

export function updateTableCellInDoc(doc, block, rowIndex, columnIndex, value) {
  const header = [...block.header];
  const rows = block.rows.map(row => [...row]);
  if (rowIndex === -1) header[columnIndex] = cleanCell(value);
  else if (rows[rowIndex]) rows[rowIndex][columnIndex] = cleanCell(value);
  const lines = String(doc ?? '').split('\n');
  return [...lines.slice(0, block.line0), tableMarkdown(header, rows), ...lines.slice(block.line1)].join('\n');
}

export function addTableRowToDoc(doc, block) {
  const rows = [...block.rows.map(row => [...row]), Array.from({ length: block.header.length }, () => '')];
  const lines = String(doc ?? '').split('\n');
  return [...lines.slice(0, block.line0), tableMarkdown(block.header, rows), ...lines.slice(block.line1)].join('\n');
}
