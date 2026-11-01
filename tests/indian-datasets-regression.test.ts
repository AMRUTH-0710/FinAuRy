import { describe, expect, it } from 'vitest';
import type { RawIngestFile } from '../contracts/index.js';
import { ingestFilesDeterministically } from '../pipeline/ingest-business.js';
import { inferDocumentSchema } from '../pipeline/schema-inference.js';
import { computeFacts } from '../pipeline/compute-facts.js';
import { runManagedAgentAudit } from '../server/managed-agent.js';
import type { IngestEnrichRequest } from '../contracts/ingest.js';

describe('Section I: 10 Indian Financial Datasets & Python vs TS Regression Suite', () => {
  // 1. Personal Expense Tracker
  it('1. Ingests Indian Personal Expense Tracker (UPI, Swiggy, Zepto, Rent, Gym) with ₹ and DD/MM/YYYY', () => {
    const csv = `Date,Merchant,Category,Description,Amount,Payment Mode
01/01/2025,Landlord Suresh Kumar,rent,Bangalore 2BHK Apartment Rent,-35000,Net Banking
03/01/2025,Cult.fit Bangalore,health,Annual Gym & Fitness Membership,-14999,Credit Card
05/01/2025,Zepto Quick Commerce,groceries,Daily milk fruits groceries,-850.50,UPI
08/01/2025,Swiggy Delivery,eating out,Dinner with friends,-1240.00,UPI
12/01/2025,Blue Tokai Coffee,coffee,Espresso & cold brew beans,-650.00,UPI
15/01/2025,Tech Solutions Salary,income,Monthly Software Engineer Salary,145000,Direct Deposit
25/01/2025,Zomato Dineout,eating out,Weekend lunch,-1850.00,UPI`;

    const file: RawIngestFile = {
      name: 'personal_expense_tracker_2025.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Aarav Personal Accounts',
      isB2B: false,
    });

    expect(bundle.transactions.length).toBe(7);
    expect(bundle.plan.business_meta?.currency_symbol).toBe('₹');
    expect(bundle.transactions[0]!.date).toBe('2025-01-01');

    const totalIncome = bundle.transactions
      .filter((t) => t.direction === 'in')
      .reduce((acc, t) => acc + t.amount_minor, 0);
    expect(totalIncome).toBe(14500000); // ₹1,45,000

    const rentTxn = bundle.transactions.find((t) => t.merchant.includes('Suresh Kumar'));
    expect(rentTxn).toBeDefined();
    expect(rentTxn?.amount_minor).toBe(3500000); // ₹35,000
  });

  // 2. College Club Expense Register
  it('2. Ingests College Club Expense Register with Coordinator Tracking & Settlement Status', () => {
    const csv = `Voucher No,Date,Vendor / Payee,Item,Purchased By,Amount,Status
V-01,10/02/2025,SoundCraft Systems,Stage Line Array & Mic,Rahul Sharma,45000,Paid
V-02,12/02/2025,Shree Graphics Prints,Fest Flex Banners & Lanyards,Ananya Iyer,14500,Pending
V-03,14/02/2025,Amrit Catering,Volunteer Food Packets,Sneha Rao,18250,Paid
V-04,16/02/2025,Campus Medical Center,First Aid Standby,Ananya Iyer,2850,Pending`;

    const file: RawIngestFile = {
      name: 'college_cultural_fest_bills.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'PUPA Fest 2025',
    });

    expect(bundle.plan.business_meta?.archetype).toBe('club_expense_register');
    expect(bundle.transactions.length).toBe(4);

    const facts = computeFacts(bundle.transactions, bundle.days, 2025, {
      isB2B: true,
      currencySymbol: '₹',
    });

    const leadPurchaser = facts.find((f) => f.id === 'club_top_purchaser_name');
    expect(leadPurchaser?.value).toBe('Rahul Sharma');

    const pendingFact = facts.find((f) => f.id === 'reimbursement_pending_minor');
    expect(pendingFact?.value).toBe(1735000); // 14,500 + 2,850 = 17,350 INR
  });

  // 3. Petty Cashbook
  it('3. Ingests Petty Cashbook with Cash Received, Cash Paid, and Balance tracking', () => {
    const csv = `Date,Particulars,Cash Received,Cash Paid,Balance
01/04/2025,Opening Imprest Cash,25000,,25000
03/04/2025,Postage & Courier,,450,24550
07/04/2025,Tea & Snacks Client Meeting,,620,23930
12/04/2025,Printer Paper Reams,,1200,22730
18/04/2025,Cash Advance Settlement,5000,,27730
25/04/2025,Office Repair Hardware,,850,26880`;

    const file: RawIngestFile = {
      name: 'delhi_office_petty_cashbook.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Delhi Branch Petty Cash',
    });

    expect(bundle.plan.business_meta?.archetype).toBe('cashbook');
    expect(bundle.transactions.length).toBe(6);

    const inflows = bundle.transactions.filter((t) => t.direction === 'in');
    const outflows = bundle.transactions.filter((t) => t.direction === 'out');
    expect(inflows.length).toBe(2);
    expect(outflows.length).toBe(4);
  });

  // 4. Business Sales and Expense Register
  it('4. Ingests Business Sales and Expense Register with Indian Lakhs and Crores', () => {
    const csv = `Date,Entity Name,Account Head,Description,Amount,Currency
15/04/2025,Infosys BPM Client,Sales Inflow,Q1 Cloud Consulting Retainer,12.5L,INR
20/04/2025,Amazon Web Services,Cloud Ops,AWS EC2 Production Cluster,-1.85L,INR
10/05/2025,WeWork India Management,Rent,Gurugram Floor Lease,-3.2L,INR
25/05/2025,TCS Enterprise Client,Sales Inflow,Enterprise Software License,25.0L,INR
15/06/2025,Razorpay Software Pvt,Payment Gateway,Merchant Transaction Fees,-0.15L,INR`;

    const file: RawIngestFile = {
      name: 'saas_sales_expense_register.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Kaveri SaaS Technologies',
    });

    expect(bundle.transactions.length).toBe(5);
    // 12.5L = 12,50,000 INR = 1,25,000,000 paise
    expect(bundle.transactions[0]!.amount_minor).toBe(125000000);
    // 1.85L = 1,85,000 INR = 18,500,000 paise
    expect(bundle.transactions[1]!.amount_minor).toBe(18500000);
  });

  // 5. Profit and Loss Statement
  it('5. Ingests Multi-Head Profit and Loss Statement rows without dropping headers', () => {
    const csv = `Period,Particulars,Head,Amount
2025-01,Gross Revenue from SaaS,Revenue,4500000
2025-01,Hosting & Server Compute,Cost of Goods Sold,-850000
2025-01,Employee Salaries & Benefits,Operating Expense,-1800000
2025-01,Marketing & Google Ads,Selling Expense,-450000
2025-01,Office Rent & Utilities,Administrative Expense,-300000`;

    const file: RawIngestFile = {
      name: 'monthly_pnl_jan_2025.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Fintech Ventures P&L',
    });

    expect(bundle.transactions.length).toBe(5);
    const revenueTxn = bundle.transactions.find((t) => t.direction === 'in');
    expect(revenueTxn?.amount_minor).toBe(450000000); // 45,00,000 INR
  });

  // 6. Bank Statement (HDFC Bank Format)
  it('6. Ingests Indian Bank Statement with paired Debit & Credit columns', () => {
    const csv = `Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
05/01/2025,NEFT CR-CITI00021-INFOSYS TECHNOLOGIES,N1209381,05/01/2025,,850000.00,1245000.00
10/01/2025,UPI-ZEPTO CONSUMER-ZEPTO@ICICI,UPI33091,10/01/2025,1250.00,,1243750.00
15/01/2025,SALARY BATCH DISBURSEMENT JAN,SAL99104,15/01/2025,450000.00,,793750.00
20/01/2025,RTGS INW-BARB01-TATA CONSULTANCY,R8821034,20/01/2025,,1200000.00,1993750.00`;

    const file: RawIngestFile = {
      name: 'HDFC_Corporate_Current_Account.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'HDFC Account Audit',
    });

    expect(bundle.plan.business_meta?.archetype).toBe('bank_statement');
    expect(bundle.transactions.length).toBe(4);
    const deposits = bundle.transactions.filter((t) => t.direction === 'in');
    const withdrawals = bundle.transactions.filter((t) => t.direction === 'out');
    expect(deposits.length).toBe(2);
    expect(withdrawals.length).toBe(2);
  });

  // 7. GST Tax Invoice Register
  it('7. Ingests GST Tax Invoice Register with GSTIN, HSN, Taxable & Total amounts', () => {
    const csv = `Invoice Date,Invoice No,Customer Name,GSTIN,Taxable Value,CGST,SGST,Total Invoice Amount
02/04/2025,INV-2025-001,Bharat Electronics Ltd,29AABCB1234F1Z5,500000,45000,45000,590000
10/04/2025,INV-2025-002,Hindustan Aeronautics Ltd,29AAACH0001A1Z2,800000,72000,72000,944000
18/04/2025,INV-2025-003,Wipro Enterprises Pvt,29AAACW9999K1Z8,250000,22500,22500,295000`;

    const file: RawIngestFile = {
      name: 'GSTR1_Sales_Register_April.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Precision Engineering Pvt Ltd',
    });

    expect(bundle.transactions.length).toBe(3);
    // Total gross sales verified
    const totalSalesMinor = bundle.transactions.reduce((acc, t) => acc + t.amount_minor, 0);
    // (590,000 + 944,000 + 295,000) * 100 = 1,829,000 * 100 = 182,900,000 paise
    expect(totalSalesMinor).toBe(182900000);
  });

  // 8. Company Financial Report
  it('8. Ingests Company Annual Financial Operations Ledger across multiple quarters', () => {
    const csv = `Date,Cost Center,Vendor,Transaction Notes,Amount
2025-01-10,R&D Engineering,Nvidia India,GPU workstation clusters,-450000
2025-04-12,Cloud Operations,AWS Asia Pacific Mumbai,Q1 Infrastructure Hosting,-125000
2025-07-15,Marketing,Google India Pvt Ltd,Digital Acquisition Campaign,-85000
2025-10-20,Legal & Audit,Deloitte Haskins & Sells,Annual Statutory Audit Fee,-200000`;

    const file: RawIngestFile = {
      name: 'corporate_capex_opex_2025.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Apex Technologies India',
    });

    expect(bundle.transactions.length).toBe(4);
    const facts = computeFacts(bundle.transactions, bundle.days, 2025, {
      isB2B: true,
      currencySymbol: '₹',
    });

    const largestBill = facts.find((f) => f.id === 'largest_bill_minor');
    expect(largestBill?.formatted).toContain('₹4,50,000');
  });

  // 9. Audit Report with Duplicate Transactions & Qualifications
  it('9. Ingests Audit Trial Dataset and Flags Potential Duplicate Vouchers', () => {
    const csv = `Date,Voucher ID,Vendor,Description,Amount
2025-03-01,V-101,Office Depot Mumbai,Printer Ink Cartridge Pack,4500
2025-03-01,V-102,Office Depot Mumbai,Printer Ink Cartridge Pack,4500
2025-03-10,V-103,Blue Dart Express,Overnight Document Courier,850
2025-03-15,V-104,Starbucks Coffee,Client Hospitality Meeting,1200`;

    const file: RawIngestFile = {
      name: 'statutory_audit_sample_ledger.csv',
      mimeType: 'text/csv',
      content: csv,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Internal Audit Review',
    });

    const facts = computeFacts(bundle.transactions, bundle.days, 2025, {
      isB2B: true,
      currencySymbol: '₹',
    });

    const dupFact = facts.find((f) => f.id === 'audit_duplicate_count');
    expect(dupFact).toBeDefined();
    // 2 rows share the same date, amount, and description
    expect(dupFact?.value).toBe(2);
  });

  // 10. Unstructured Spreadsheet with Generic Column Headers
  it('10. Ingests Unstructured Spreadsheet with Column1, Unnamed: 2, and Particulars', () => {
    const headers = ['Date', 'Unnamed: 1', 'Particulars', 'Column1', 'Status'];
    const sampleRows = [
      ['01/02/2025', 'Ref-9901', 'Sound & Stage Rental', '35000', 'Cleared'],
      ['05/02/2025', 'Ref-9902', 'Printing Banners', '12000', 'Pending'],
      ['10/02/2025', 'Ref-9903', 'Catering Supplies', '18500', 'Cleared'],
    ];

    const schema = inferDocumentSchema(headers, sampleRows, 'Messy_Accounting_Export.xlsx');
    expect(schema.dateColIndex).toBe(0);
    expect(schema.amountColIndex).toBe(3); // Column1 inferred as amount
    expect(schema.descColIndex).toBe(2); // Particulars inferred as description

    const csvContent = `Date,Unnamed: 1,Particulars,Column1,Status
01/02/2025,Ref-9901,Sound & Stage Rental,35000,Cleared
05/02/2025,Ref-9902,Printing Banners,12000,Pending
10/02/2025,Ref-9903,Catering Supplies,18500,Cleared`;

    const file: RawIngestFile = {
      name: 'Messy_Accounting_Export.csv',
      mimeType: 'text/csv',
      content: csvContent,
      encoding: 'utf8',
    };

    const bundle = ingestFilesDeterministically([file], {
      entityName: 'Generic Column Recovery',
    });

    expect(bundle.transactions.length).toBe(3);
    expect(bundle.transactions[0]!.amount_minor).toBe(3500000);
  });

  // Comparison: TypeScript Deterministic Results vs Python Managed Agent
  describe('TypeScript vs Python Managed Agent Calculation Parity', () => {
    it('compares deterministic TypeScript audit facts with Managed Agent audit notes for identical input', async () => {
      const csv = `Date,Vendor,Department,Description,Amount,Currency
2025-01-05,Stripe Inflow,Revenue,Subscription ARR,500000.00,INR
2025-01-15,Amazon Web Services,Cloud Ops,Production Hosting,-75000.00,INR
2025-02-15,Amazon Web Services,Cloud Ops,Production Hosting,-80000.00,INR
2025-03-15,Snowflake India,Analytics,Data Warehouse Cluster,-35000.00,INR
2025-04-10,Dell Technologies,Hardware CapEx,Server Rack Expansion,-150000.00,INR`;

      const file: RawIngestFile = {
        name: 'cloud_saas_benchmark.csv',
        mimeType: 'text/csv',
        content: csv,
        encoding: 'utf8',
      };

      const bundle = ingestFilesDeterministically([file], {
        entityName: 'Benchmark SaaS India',
      });

      // 1. TypeScript deterministic facts
      const facts = computeFacts(bundle.transactions, bundle.days, 2025, {
        isB2B: true,
        currencySymbol: '₹',
      });

      const totalOutflowFact = facts.find((f) => f.id === 'total_out' || f.id === 'total_spend_usd');
      const totalInflowFact = facts.find((f) => f.id === 'total_in' || f.id === 'total_inflow_usd');
      const topVendorFact = facts.find((f) => f.id === 'top_merchant_by_spend_name' || f.id === 'top_merchant_name');
      const bigOneFact = facts.find((f) => f.id === 'big_one_amount' || f.id === 'big_one_spend');

      expect(totalInflowFact?.formatted).toContain('₹5,00,000');
      // Total outflows: 75,000 + 80,000 + 35,000 + 150,000 = 340,000 = ₹3,40,000
      expect(totalOutflowFact?.formatted).toContain('₹3,40,000');
      expect(topVendorFact?.value).toBe('AWS');
      expect(bigOneFact?.formatted).toContain('₹1,50,000');

      // 2. Python Managed Agent audit simulation
      const req: IngestEnrichRequest = {
        entity_name_hint: 'Benchmark SaaS India',
        facts_summary: facts.map((f) => ({
          id: f.id,
          label: f.label,
          formatted: f.formatted,
          computation: f.computation,
        })),
        raw_rows: bundle.transactions.map((t) => t.source_row),
      };

      // Run managed agent audit (in deterministic fallback mode since no API key is passed here)
      const agentResult = await runManagedAgentAudit(req, {
        apiKey: '',
        hasApiKey: false,
        modelName: 'gemini-4-argon',
        agentId: 'antigravity-preview-09-2026',
        port: 3000,
        host: '0.0.0.0',
      });

      expect(agentResult.source).toBe('managed_agent');
      expect(agentResult.narrative?.agent_audit_notes).toBeDefined();
      expect(agentResult.narrative?.agent_audit_notes?.length).toBeGreaterThanOrEqual(2);

      const notes = agentResult.narrative!.agent_audit_notes!;
      // Verify that agent audit notes match the exact numbers from deterministic TypeScript facts
      const inflowReconciled = notes.some((n) => n.includes('₹5,00,000') && n.includes('₹3,40,000'));
      expect(inflowReconciled).toBe(true);

      const topVendorReported = notes.some((n) => n.includes('AWS'));
      expect(topVendorReported).toBe(true);

      const bigOneReported = notes.some((n) => n.includes('₹1,50,000') || n.includes('Dell Technologies'));
      expect(bigOneReported).toBe(true);
    });
  });
});
