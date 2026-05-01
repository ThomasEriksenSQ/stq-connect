import { readSheet, type CellValue } from "read-excel-file/browser";

export type ExcelCell = CellValue;
export type ExcelRow = ExcelCell[];

export async function readFirstSheetRows(file: File): Promise<ExcelRow[]> {
  return readSheet(file);
}

export async function readFirstSheetObjects(file: File): Promise<Array<Record<string, ExcelCell>>> {
  const [headerRow, ...dataRows] = await readFirstSheetRows(file);
  if (!headerRow) return [];

  const headers = headerRow.map((cell) => excelCellToText(cell));

  return dataRows.map((row) => {
    const record: Record<string, ExcelCell> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = row[index] ?? null;
    });
    return record;
  });
}

export function excelCellToText(value: ExcelCell): string {
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
