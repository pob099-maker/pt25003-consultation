export type CsvValue = string | number | null | undefined;
export type CsvRow = Readonly<Record<string, CsvValue>>;

/**
 * A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
 * Free-text answers are written by the public, so neutralise it on the way out.
 */
const neutraliseFormula = (text: string): string =>
  /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

const escapeCell = (value: CsvValue): string => {
  if (value === null || value === undefined) return '';
  const text = neutraliseFormula(String(value));
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
};

export const toCsv = (headers: readonly string[], rows: readonly CsvRow[]): string => {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  }
  // Excel on Windows is much happier opening UTF-8 CSV with a BOM, and the
  // region names carry em dashes.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
};

export const downloadText = (filename: string, text: string, mimeType: string): void => {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadCsv = (filename: string, csv: string): void => downloadText(filename, csv, 'text/csv');
