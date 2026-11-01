import { describe, expect, it } from 'vitest';
import { extractFilePreview, getSampleFilePreview } from '../src/App.js';

describe('Uploaded File Preview Modal & Truncated Table View Tests', () => {
  describe('extractFilePreview on CSV files', () => {
    it('parses CSV headers, rows, and correctly computes truncation count', async () => {
      // Generate a 25-row CSV ledger
      const header = 'Date,Description,Category,Amount\n';
      const rows = Array.from({ length: 25 }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return `2025-04-${day},Vendor Payment ${i + 1},Operations,₹${(i + 1) * 1000}`;
      }).join('\n');

      const csvContent = header + rows;
      const file = new File([csvContent], 'mumbai_operations.csv', { type: 'text/csv' });

      const preview = await extractFilePreview(file);

      expect(preview.fileName).toBe('mumbai_operations.csv');
      expect(preview.fileType).toBe('csv');
      expect(preview.headers).toEqual(['Date', 'Description', 'Category', 'Amount']);
      expect(preview.totalRows).toBe(25);
      expect(preview.totalColumns).toBe(4);
      // Truncated table view shows exactly the first 10 rows
      expect(preview.rows.length).toBe(10);
      expect(preview.rows[0]).toEqual(['2025-04-01', 'Vendor Payment 1', 'Operations', '₹1000']);
      expect(preview.rows[9]).toEqual(['2025-04-10', 'Vendor Payment 10', 'Operations', '₹10000']);
      // 25 - 10 = 15 rows truncated
      expect(preview.truncatedCount).toBe(15);
    });

    it('correctly parses CSV with commas inside double quotes', async () => {
      const csv = `Date,Entity,"Category, Subcategory",Amount
15/05/2025,"Reliance Industries, Mumbai","Enterprise, CapEx",₹120000.50
18/05/2025,Tata Digital,"Software, SaaS",₹45000.00`;

      const file = new File([csv], 'gst_tax_invoice.csv', { type: 'text/csv' });
      const preview = await extractFilePreview(file);

      expect(preview.headers).toEqual(['Date', 'Entity', 'Category, Subcategory', 'Amount']);
      expect(preview.totalRows).toBe(2);
      expect(preview.rows.length).toBe(2);
      expect(preview.rows[0]![1]).toBe('Reliance Industries, Mumbai');
      expect(preview.rows[0]![2]).toBe('Enterprise, CapEx');
      expect(preview.rows[0]![3]).toBe('₹120000.50');
      expect(preview.truncatedCount).toBe(0);
    });
  });

  describe('extractFilePreview on JSON files', () => {
    it('parses JSON datasets into a tabular preview', async () => {
      const jsonRecords = [
        { date: '2025-01-10', merchant: 'AWS Mumbai', amount: '₹45,000' },
        { date: '2025-01-15', merchant: 'WeWork Bangalore', amount: '₹85,000' },
        { date: '2025-01-20', merchant: 'Airtel Enterprise', amount: '₹12,000' },
      ];

      const file = new File([JSON.stringify(jsonRecords)], 'cloud_costs.json', {
        type: 'application/json',
      });
      const preview = await extractFilePreview(file);

      expect(preview.fileName).toBe('cloud_costs.json');
      expect(preview.fileType).toBe('json');
      expect(preview.headers).toEqual(['date', 'merchant', 'amount']);
      expect(preview.totalRows).toBe(3);
      expect(preview.rows.length).toBe(3);
      expect(preview.rows[0]).toEqual(['2025-01-10', 'AWS Mumbai', '₹45,000']);
      expect(preview.truncatedCount).toBe(0);
    });
  });

  describe('getSampleFilePreview for Quick Samples', () => {
    it('returns rich preview data for Q3_Consolidated_P&L.xlsx', () => {
      const preview = getSampleFilePreview('Q3_Consolidated_P&L.xlsx');
      expect(preview.fileName).toBe('Q3_Consolidated_P&L.xlsx');
      expect(preview.fileType).toBe('xlsx');
      expect(preview.sheetName).toBe('Consolidated P&L Statement');
      expect(preview.headers).toContain('Date');
      expect(preview.headers).toContain('Amount (INR ₹)');
      expect(preview.totalRows).toBe(248);
      // Table view is truncated to 10 rows
      expect(preview.rows.length).toBe(10);
      expect(preview.truncatedCount).toBe(238);
    });

    it('returns rich preview data for SeriesB_Ledger.csv', () => {
      const preview = getSampleFilePreview('SeriesB_Ledger.csv');
      expect(preview.fileName).toBe('SeriesB_Ledger.csv');
      expect(preview.fileType).toBe('csv');
      expect(preview.headers).toContain('Txn ID');
      expect(preview.headers).toContain('Counterparty');
      expect(preview.totalRows).toBe(420);
      expect(preview.rows.length).toBe(10);
      expect(preview.truncatedCount).toBe(410);
    });
  });
});
