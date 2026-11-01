import { describe, expect, it } from 'vitest';
import { ingestFilesDeterministically } from '../pipeline/ingest-business.js';
import { parseUniversalBusinessData } from '../pipeline/parse.js';
import { inferDocumentSchema } from '../pipeline/schema-inference.js';
import type { RawIngestFile } from '../contracts/index.js';

describe('Universal Financial Understanding Engine', () => {
  describe('Contextual Schema & Generic Column Inference', () => {
    it('infers Column1 as Amount and DAY as day of week despite non-standard headers', () => {
      const headers = ['Date', 'DAY', 'Vendor name', 'Purchased By', 'Category', 'Column1', 'settlement'];
      const sampleRows = [
        ['10/02/2025', 'Monday', 'SoundCraft Systems', 'Rahul Sharma', 'Sound', '45000', 'paid'],
        ['12/02/2025', 'Wednesday', 'Shree Graphics', 'Ananya Iyer', 'Printing', '14500', ''],
        ['14/02/2025', 'Friday', 'ProDJ Equipment', 'Vikram Patel', 'Stage', '28000', 'paid'],
      ];

      const schema = inferDocumentSchema(headers, sampleRows, 'PUPA BILLS RECORD.xlsx');
      expect(schema.documentType).toBe('club_expense_register');
      expect(schema.dateColIndex).toBe(0);
      expect(schema.amountColIndex).toBe(5); // Column1
      expect(schema.purchaserColIndex).toBe(3); // Purchased By
      expect(schema.statusColIndex).toBe(6); // settlement

      const col1Meta = schema.columns[5]!;
      expect(col1Meta.role).toBe('amount');
      expect(col1Meta.confidence).toBeGreaterThanOrEqual(0.8);
      expect(col1Meta.evidence).toContain('Inferred Amount');

      const dayMeta = schema.columns[1]!;
      expect(dayMeta.role).toBe('day_of_week');
    });

    it('infers Unnamed: 3 as amount in messy CSV exports', () => {
      const rawMessyCsv = `
  Date  ,  Vendor / Merchant  ,  Category  ,  Unnamed: 3  ,  Status  
2025-01-10,Amazon Web Services,Cloud Infrastructure,34200.50,Approved
2025-01-15,Google Cloud India,DevOps Nodes,18900.00,Approved
2025-01-20,Razorpay Gateway,Processing,450.00,Approved
`.trim();

      const parsed = parseUniversalBusinessData(rawMessyCsv, 'Cloud_Spend.csv');
      expect(parsed.rows.length).toBe(3);
      expect(parsed.rows[0]?.amount).toBe('-34200.50');
      expect(parsed.rows[0]?.description).toContain('Amazon Web Services');
    });
  });

  describe('Multi-Format & Archetype Understanding', () => {
    it('understands Cashbooks with Cash Received, Cash Paid, and Balances', () => {
      const cashbookCsv = `
Date,Particulars,Cash Received,Cash Paid,Balance
01/03/2025,Opening Balance,50000,,50000
03/03/2025,Office Stationery,,2500,47500
05/03/2025,Cash Sales Inflow,12000,,59500
08/03/2025,Courier & Logistics,,800,58700
10/03/2025,Client Advance,25000,,83700
`.trim();

      const files: RawIngestFile[] = [
        {
          name: 'Main_Petty_Cashbook.csv',
          mimeType: 'text/csv',
          content: cashbookCsv,
          encoding: 'utf8',
        },
      ];

      const bundle = ingestFilesDeterministically(files, { entityName: 'Office Petty Cash' });
      expect(bundle.transactions.length).toBe(5);
      expect(bundle.plan.business_meta?.archetype).toBe('cashbook');
      expect(bundle.plan.person_name).toContain('Office Petty Cash');

      // Verify inflows vs outflows
      const inflows = bundle.transactions.filter((t) => t.direction === 'in');
      const outflows = bundle.transactions.filter((t) => t.direction === 'out');
      expect(inflows.length).toBe(3);
      expect(outflows.length).toBe(2);
    });

    it('understands Bank Statements with paired Debit and Credit columns', () => {
      const bankStatementCsv = `
Tran Date,Value Date,Description,Chq / Ref No,Debit,Credit,Balance
2025-02-01,2025-02-01,INFOSYS TECH DIRECT CR,NEFT90812,,1500000.00,2450000.00
2025-02-05,2025-02-05,OFFICE RENT EMBASSY,CHQ88120,250000.00,,2200000.00
2025-02-12,2025-02-12,AIRTEL LEASED LINE CORP,UPI11204,18500.00,,2181500.00
`.trim();

      const files: RawIngestFile[] = [
        {
          name: 'HDFC_Current_Account_Statement.csv',
          mimeType: 'text/csv',
          content: bankStatementCsv,
          encoding: 'utf8',
        },
      ];

      const bundle = ingestFilesDeterministically(files, { entityName: 'Apex Enterprises' });
      expect(bundle.transactions.length).toBe(3);
      expect(bundle.plan.business_meta?.archetype).toBe('bank_statement');

      // Debit should be outflow, Credit should be inflow
      const creditTxn = bundle.transactions.find((t) => t.raw_description.includes('INFOSYS'));
      expect(creditTxn?.direction).toBe('in');
      expect(creditTxn?.amount_minor).toBe(150000000); // 15 Lakh INR = 150,000,000 paise

      const rentTxn = bundle.transactions.find((t) => t.raw_description.includes('OFFICE RENT'));
      expect(rentTxn?.direction).toBe('out');
      expect(rentTxn?.amount_minor).toBe(25000000); // 2.5 Lakh INR
    });

    it('understands Sales Ledgers with Customers, Units, and Sales Inflows', () => {
      const salesCsv = `
Invoice Date,Invoice No,Customer Name,Product Line,Units,Sales Amount,Payment Status
15/01/2025,INV-1001,Tata Motors Corp,Enterprise Cloud ERP,5,1250000,Settled
22/01/2025,INV-1002,Mahindra Tech,AI Analytics Module,2,650000,Settled
28/01/2025,INV-1003,Reliance Retail,Custom Integration,1,400000,Pending
`.trim();

      const files: RawIngestFile[] = [
        {
          name: 'Q1_Sales_Revenue_Ledger.csv',
          mimeType: 'text/csv',
          content: salesCsv,
          encoding: 'utf8',
        },
      ];

      const bundle = ingestFilesDeterministically(files, { entityName: 'SaaS Platform Sales' });
      expect(bundle.transactions.length).toBe(3);
      expect(bundle.plan.business_meta?.archetype).toBe('sales_ledger');
      // Sales revenue is recognized as inflow
      expect(bundle.transactions.every((t) => t.direction === 'in')).toBe(true);
    });
  });

  describe('Error Handling and Guardrails', () => {
    it('throws clear explanatory error when content has no dates or amounts', () => {
      const randomTextCsv = `
Name,Department,Designation,Blood Group
Ramesh,Engineering,Senior Architect,O+
Suresh,Marketing,Lead Designer,B+
`.trim();

      expect(() => {
        parseUniversalBusinessData(randomTextCsv, 'Staff_List.csv');
      }).toThrow();
    });
  });
});
