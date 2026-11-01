import { describe, expect, it } from 'vitest';
import { getFileType } from '../src/App.js';

describe('App Drop Zone File Type Detection', () => {
  it('detects CSV files from filename or status text', () => {
    expect(getFileType('transactions.csv')).toBe('csv');
    expect(getFileType('SERIES_B_LEDGER.CSV')).toBe('csv');
    expect(getFileType(null, 'Attached: q4_revenue.csv')).toBe('csv');
  });

  it('detects XLSX and XLS spreadsheet files', () => {
    expect(getFileType('balance_sheet_2025.xlsx')).toBe('xlsx');
    expect(getFileType('legacy_export.xls')).toBe('xlsx');
    expect(getFileType('Q3_Consolidated_P&L.xlsx')).toBe('xlsx');
    expect(getFileType(null, '1 file selected: sample_financial_ledger_2025.xlsx')).toBe('xlsx');
  });

  it('detects JSON files', () => {
    expect(getFileType('audit_records.json')).toBe('json');
    expect(getFileType('DATA_TREE.JSON')).toBe('json');
    expect(getFileType(null, 'Attached: 03_capex.json')).toBe('json');
  });

  it('detects PDF documents', () => {
    expect(getFileType('quarterly_report.pdf')).toBe('pdf');
    expect(getFileType('INVOICE_DEC_2025.PDF')).toBe('pdf');
  });

  it('detects TSV and TXT data files', () => {
    expect(getFileType('tab_delimited.tsv')).toBe('tsv');
    expect(getFileType('readme.txt')).toBe('txt');
  });

  it('falls back to generic for unknown or empty extensions', () => {
    expect(getFileType('')).toBe('generic');
    expect(getFileType(null, null)).toBe('generic');
    expect(getFileType('archive.bin')).toBe('generic');
  });
});
