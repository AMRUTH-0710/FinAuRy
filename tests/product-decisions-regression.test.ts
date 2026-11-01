import { describe, expect, it } from 'vitest';
import type { RawIngestFile } from '../contracts/index.js';
import { ingestFilesDeterministically } from '../pipeline/ingest-business.js';
import { runPolymorphicReconciliation } from '../pipeline/reconcile.js';
import {
  inferDocumentSchema,
  inferIndianAccountingFramework,
  validateDataConfidence,
} from '../pipeline/schema-inference.js';
import { generateAuditFindings } from '../pipeline/verification.js';
import { normalizeHeaderForMatching, parseUniversalBusinessData } from '../pipeline/parse.js';
import { answerQuestionDeterministically } from '../src/ask/index.js';

describe('Refined Product Roadmap Decisions Regression Suite', () => {
  // -------------------------------------------------------------
  // Decision 1: Data Confidence
  // -------------------------------------------------------------
  describe('Product Decision 1: Data Confidence Engine', () => {
    it('validates inferred fields, missing values, ambiguous dates, and duplicates without crashing', () => {
      const schema = inferDocumentSchema(
        ['Date', 'Description', 'Amount', 'Status'],
        [
          ['05/06/2025', 'Office High-Speed Internet', '3500', 'Paid'],
          ['05/06/2025', 'Office High-Speed Internet', '3500', 'Paid'],
          ['', 'Missing Date Expense', '1200', 'Paid'],
          ['10/08/2025', 'Zero or Empty Amount', '', 'Pending'],
          ['12/11/2025', 'Ambiguous Date Voucher', '4500', 'Paid'],
        ],
        'audit_test.csv'
      );

      const rawRows = [
        {
          id: 'row-1',
          date: '05/06/2025',
          posted_date: '05/06/2025',
          account: 'Primary',
          tran_type: 'debit',
          description: 'Office High-Speed Internet',
          amount: '3500',
          currency: 'INR',
        },
        {
          id: 'row-2',
          date: '05/06/2025',
          posted_date: '05/06/2025',
          account: 'Primary',
          tran_type: 'debit',
          description: 'Office High-Speed Internet',
          amount: '3500',
          currency: 'INR',
        },
        {
          id: 'row-3',
          date: '',
          posted_date: '',
          account: 'Primary',
          tran_type: 'debit',
          description: 'Missing Date Expense',
          amount: '1200',
          currency: 'INR',
        },
        {
          id: 'row-4',
          date: '10/08/2025',
          posted_date: '10/08/2025',
          account: 'Primary',
          tran_type: 'debit',
          description: 'Zero or Empty Amount',
          amount: '',
          currency: 'INR',
        },
        {
          id: 'row-5',
          date: '12/11/2025',
          posted_date: '12/11/2025',
          account: 'Primary',
          tran_type: 'debit',
          description: 'Ambiguous Date Voucher',
          amount: '4500',
          currency: 'INR',
        },
      ];

      const report = validateDataConfidence(rawRows, schema);

      expect(report.missingValueCount).toBe(2); // 1 missing date, 1 missing amount
      expect(report.duplicateCount).toBe(1); // row-1 and row-2 are duplicates
      expect(report.ambiguousDatesCount).toBeGreaterThanOrEqual(1); // 05/06 and 12/11 are both <= 12
      expect(report.currencyConsistency).toBe(true);
      expect(report.overallScore).toBeLessThan(100);
      expect(report.overallScore).toBeGreaterThanOrEqual(20);
    });
  });

  // -------------------------------------------------------------
  // Decision 2: Reconciliation Centre
  // -------------------------------------------------------------
  describe('Product Decision 2: Reusable Reconciliation Engine', () => {
    it('executes Cashbook balance reconciliation with exact expected, actual, and difference', () => {
      const csv = `Date,Particulars,Cash Received,Cash Paid,Balance
01/04/2025,Opening Imprest Cash,20000,,20000
05/04/2025,Printing Brochures,,4500,15500
10/04/2025,Client Advance Received,10000,,25500
15/04/2025,Office Furniture Repair,,2500,23000
30/04/2025,Closing Cash Balance,,,23000`;

      const file: RawIngestFile = {
        name: 'cashbook_april_2025.csv',
        mimeType: 'text/csv',
        content: csv,
      };

      const bundle = ingestFilesDeterministically([file]);
      expect(bundle.plan.business_meta?.reconciliation_report).toBeDefined();

      const recon = bundle.plan.business_meta!.reconciliation_report!;
      const cashbookCheck = recon.checks.find((c) => c.ruleType === 'cashbook_balance');

      expect(cashbookCheck).toBeDefined();
      expect(cashbookCheck?.formula).toContain('Opening Balance + Cash Receipts - Cash Payments = Closing Balance');
      // Opening: 20,000 + Receipts: 10,000 - Payments: 7,000 = Expected Closing: 23,000 (2300000 paise)
      expect(cashbookCheck?.expectedMinor).toBe(2300000);
      expect(cashbookCheck?.actualMinor).toBe(2300000);
      expect(cashbookCheck?.differenceMinor).toBe(0);
      expect(cashbookCheck?.isReconciled).toBe(true);
    });

    it('executes Ledger vs Supporting Bills reconciliation for college club / events', () => {
      const csv = `Voucher No,Date,Vendor / Payee,Item,Purchased By,Amount,Status
V-01,10/02/2025,SoundCraft Systems,Stage Line Array & Mic,Rahul Sharma,40000,Paid
V-02,12/02/2025,Shree Graphics Prints,Fest Flex Banners,Ananya Iyer,15000,Pending
V-03,14/02/2025,Amrit Catering,Volunteer Food Packets,Sneha Rao,20000,Paid`;

      const file: RawIngestFile = {
        name: 'pupa_fest_bills.csv',
        mimeType: 'text/csv',
        content: csv,
      };

      const bundle = ingestFilesDeterministically([file], {
        entityName: 'PUPA 2025 Cultural Council',
      });

      const recon = bundle.plan.business_meta!.reconciliation_report!;
      const billsCheck = recon.checks.find((c) => c.ruleType === 'ledger_vs_bills');

      expect(billsCheck).toBeDefined();
      expect(billsCheck?.formula).toContain('Total Billed Expenses == Settled (Paid) + Pending Reimbursements');
      // 40,000 + 15,000 + 20,000 = 75,000 total billed
      expect(billsCheck?.expectedMinor).toBe(7500000);
      expect(billsCheck?.actualMinor).toBe(7500000);
      expect(billsCheck?.differenceMinor).toBe(0);
      expect(billsCheck?.isReconciled).toBe(true);
      expect(billsCheck?.supportingTxnIds.length).toBe(3);
    });

    it('does not apply irrelevant formulas to non-matching documents', () => {
      const mockRawRow = {
        id: 't1',
        date: '01/01/2025',
        posted_date: '01/01/2025',
        account: 'Primary',
        tran_type: 'debit',
        description: 'Zepto Quick Commerce',
        amount: '-850',
        currency: 'INR',
      };
      const recon = runPolymorphicReconciliation({
        transactions: [
          {
            id: 't1',
            date: '2025-01-01',
            amount_minor: 85000,
            currency: 'INR',
            direction: 'out',
            raw_description: 'Zepto Quick Commerce',
            merchant: 'Zepto',
            merchant_confidence: 1,
            category: 'groceries',
            category_confidence: 1,
            is_recurring: false,
            is_transfer: false,
            is_refund: false,
            source_row: mockRawRow,
          },
        ],
        archetype: 'consumer_personal',
      });

      // Cashbook and Ledger voucher formulas should NOT be applied to pure personal expense lists
      const cashbookCheck = recon.checks.find((c) => c.ruleType === 'cashbook_balance');
      const ledgerCheck = recon.checks.find((c) => c.ruleType === 'ledger_vs_bills');

      expect(cashbookCheck).toBeUndefined();
      expect(ledgerCheck).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Decision 3: Integrate Ask Finance Story into Explore
  // -------------------------------------------------------------
  describe('Product Decision 3: Ask Finance Story Integration', () => {
    it('answers Indian natural language queries using deterministic data and provides source receipts', () => {
      const rawRow1 = {
        id: 'swiggy-1',
        date: '10/01/2025',
        posted_date: '10/01/2025',
        account: 'Primary',
        tran_type: 'debit',
        description: 'Swiggy Delivery Dinner',
        amount: '-1250',
        currency: 'INR',
      };
      const rawRow2 = {
        id: 'swiggy-2',
        date: '18/01/2025',
        posted_date: '18/01/2025',
        account: 'Primary',
        tran_type: 'debit',
        description: 'Swiggy Quick Food',
        amount: '-850',
        currency: 'INR',
      };
      const transactions = [
        {
          id: 'swiggy-1',
          date: '2025-01-10',
          amount_minor: 125000, // ₹1,250
          currency: 'INR',
          direction: 'out' as const,
          raw_description: 'Swiggy Delivery Dinner',
          merchant: 'Swiggy',
          merchant_confidence: 1,
          category: 'takeaway' as const,
          category_confidence: 1,
          is_recurring: false,
          is_transfer: false,
          is_refund: false,
          source_row: rawRow1,
        },
        {
          id: 'swiggy-2',
          date: '2025-01-18',
          amount_minor: 85000, // ₹850
          currency: 'INR',
          direction: 'out' as const,
          raw_description: 'Swiggy Quick Food',
          merchant: 'Swiggy',
          merchant_confidence: 1,
          category: 'takeaway' as const,
          category_confidence: 1,
          is_recurring: false,
          is_transfer: false,
          is_refund: false,
          source_row: rawRow2,
        },
      ];

      const answer = answerQuestionDeterministically('How much did I spend on Swiggy?', transactions);

      expect(answer.answerable).toBe(true);
      expect(answer.formatted_answer).toBe('$2,100'); // 1250 + 850 = 2100 (formatted via minor)
      expect(answer.matching_txn_ids).toEqual(['swiggy-1', 'swiggy-2']);
      expect(answer.receipts.length).toBe(2);
      expect(answer.receipts[0]?.merchant).toBe('Swiggy');
    });
  });

  // -------------------------------------------------------------
  // Decision 4: India Finance Intelligence
  // -------------------------------------------------------------
  describe('Product Decision 4: India Finance Intelligence & Frameworks', () => {
    it('identifies applicable Indian Accounting Framework for personal, club, MSME, and corporate records', () => {
      const personal = inferIndianAccountingFramework('consumer_personal', 'Aarav Personal UPI Account');
      expect(personal.framework).toBe('personal_informal_ledger');
      expect(personal.standardLabel).toBe('Personal Cash Flow Management (Informal Ledger)');
      expect(personal.regulatoryBody).toContain('Informal Budgeting');
      expect(personal.legalCitations.some((c) => c.includes('Non-Statutory'))).toBe(true);
      expect(personal.legalCitations.some((c) => c.includes('Section 14'))).toBe(false);

      const club = inferIndianAccountingFramework('club_expense_register', 'PUPA College Fest Register');
      expect(club.framework).toBe('club_receipts_payments');
      expect(club.standardLabel).toContain('Receipts & Payments');

      const msme = inferIndianAccountingFramework('cashbook', 'Delhi Trader Petty Cashbook');
      expect(msme.framework).toBe('micro_business_as');
      expect(msme.legalCitations.some((c) => c.includes('AS 1'))).toBe(true);
      expect(msme.legalCitations.some((c) => c.includes('AS 9'))).toBe(true);
      expect(msme.legalCitations.some((c) => c.includes('Section 44AB') && c.includes('NOT an Accounting Standard'))).toBe(true);

      const corporate = inferIndianAccountingFramework('enterprise_pnl', 'Bangalore SaaS Tech Pvt Ltd');
      expect(corporate.framework).toBe('corporate_ind_as_schedule_iii');
      expect(corporate.legalCitations.some((c) => c.includes('Schedule III'))).toBe(true);
    });

    it('calculates Indian Financial Year (FY: 1 April - 31 March) accurately in facts', () => {
      const csv = `Date,Description,Amount
15/04/2024,TCS Software Billing,1500000
20/08/2024,Cloud Server Hosting,-45000
10/02/2025,Office Rent Bangalore,-85000`;

      const file: RawIngestFile = {
        name: 'tech_operations_fy2425.csv',
        mimeType: 'text/csv',
        content: csv,
      };

      const bundle = ingestFilesDeterministically([file]);
      const fyFact = bundle.facts.find((f) => f.id === 'indian_fy_label');

      expect(fyFact).toBeDefined();
      expect(fyFact?.formatted).toBe('FY 2024-25');
    });
  });

  // -------------------------------------------------------------
  // Decision 5: Audit & Evidence Mode
  // -------------------------------------------------------------
  describe('Product Decision 5: Audit and Evidence Mode', () => {
    it('generates structured audit findings distinguishing confirmed errors, anomalies, and missing evidence with exact sources', () => {
      const rawRows = [
        {
          id: 'txn-v1-a',
          date: '10/02/2025',
          posted_date: '10/02/2025',
          account: 'Club Account',
          tran_type: 'debit',
          description: 'Stage Sound Line Array',
          amount: '45000',
          currency: 'INR',
          bill_number: 'V-01',
          source_file: 'pupa_bills.xlsx',
          source_sheet: 'Audio-Visual',
          source_row_index: 12,
        },
        {
          id: 'txn-v1-b',
          date: '11/02/2025',
          posted_date: '11/02/2025',
          account: 'Club Account',
          tran_type: 'debit',
          description: 'Stage Sound Line Array Additional',
          amount: '52000',
          currency: 'INR',
          bill_number: 'V-01',
          source_file: 'pupa_bills.xlsx',
          source_sheet: 'Audio-Visual',
          source_row_index: 18,
        },
        {
          id: 'txn-unvouched',
          date: '15/02/2025',
          posted_date: '15/02/2025',
          account: 'Club Account',
          tran_type: 'debit',
          description: 'Unrecorded Cash Handout for Stalls',
          amount: '35000',
          currency: 'INR',
          source_file: 'pupa_bills.xlsx',
          source_sheet: 'Miscellaneous',
          source_row_index: 24,
        },
      ];

      const transactions = [
        // Conflicting duplicate voucher amount (Confirmed Error)
        {
          id: 'txn-v1-a',
          date: '2025-02-10',
          amount_minor: 4500000, // ₹45,000
          currency: 'INR',
          direction: 'out' as const,
          raw_description: 'Stage Sound Line Array',
          merchant: 'SoundCraft Systems',
          merchant_confidence: 1,
          category: 'shopping' as const,
          category_confidence: 1,
          bill_number: 'V-01',
          is_recurring: false,
          is_transfer: false,
          is_refund: false,
          source_row: rawRows[0]!,
        },
        {
          id: 'txn-v1-b',
          date: '2025-02-11',
          amount_minor: 5200000, // ₹52,000 (conflicts with V-01 above)
          currency: 'INR',
          direction: 'out' as const,
          raw_description: 'Stage Sound Line Array Additional',
          merchant: 'SoundCraft Systems',
          merchant_confidence: 1,
          category: 'shopping' as const,
          category_confidence: 1,
          bill_number: 'V-01',
          is_recurring: false,
          is_transfer: false,
          is_refund: false,
          source_row: rawRows[1]!,
        },
        // Unvouched high-value disbursement (Missing Evidence)
        {
          id: 'txn-unvouched',
          date: '2025-02-15',
          amount_minor: 3500000, // ₹35,000 (> ₹20,000 threshold with no bill number)
          currency: 'INR',
          direction: 'out' as const,
          raw_description: 'Unrecorded Cash Handout for Stalls',
          merchant: 'Local Stalls Contractor',
          merchant_confidence: 0.8,
          category: 'shopping' as const,
          category_confidence: 0.8,
          is_recurring: false,
          is_transfer: false,
          is_refund: false,
          source_row: rawRows[2]!,
        },
      ];

      const findings = generateAuditFindings({
        transactions,
        rawRows,
        archetype: 'club_expense_register',
        currencySymbol: '₹',
        sourceFileName: 'pupa_bills.xlsx',
      });

      // 1. Confirmed Error
      const confirmedError = findings.find((f) => f.severity === 'confirmed_error');
      expect(confirmedError).toBeDefined();
      expect(confirmedError?.title).toContain('Conflicting Amounts for Voucher / Bill V-01');
      expect(confirmedError?.sourceFile).toBe('pupa_bills.xlsx');
      expect(confirmedError?.sourceSheet).toBe('Audio-Visual');
      expect(confirmedError?.sourceRow).toBe(12);
      expect(confirmedError?.expectedAmountMinor).toBe(4500000);
      expect(confirmedError?.actualAmountMinor).toBe(5200000);
      expect(confirmedError?.differenceMinor).toBe(700000); // ₹7,000
      expect(confirmedError?.regulatoryReference).toContain('ICAI SA 500');

      // 2. Missing Evidence
      const missingEvidence = findings.find((f) => f.severity === 'missing_evidence');
      expect(missingEvidence).toBeDefined();
      expect(missingEvidence?.title).toContain('Missing Bill / Voucher Number');
      expect(missingEvidence?.actualAmountMinor).toBe(3500000);
      expect(missingEvidence?.suggestedNextStep).toContain('supporting GST invoice or vendor payment voucher');
      expect(missingEvidence?.regulatoryReference).toContain('Section 40A(3)');
    });
  });

  // -------------------------------------------------------------
  // Bank Statement Header Normalization & Parsing Regression Tests
  // -------------------------------------------------------------
  describe('Bank Statement Header Normalization & Ingestion', () => {
    it('normalizes common bank header variations accurately', () => {
      // Debit variations
      expect(normalizeHeaderForMatching('Withdrawal')).toBe('withdrawal');
      expect(normalizeHeaderForMatching('Withdrawal (Dr)')).toBe('withdrawal');
      expect(normalizeHeaderForMatching('Withdrawal (Dr.)')).toBe('withdrawal');
      expect(normalizeHeaderForMatching('Withdrawals')).toBe('withdrawal');
      expect(normalizeHeaderForMatching('Withdrawal Amt.')).toBe('withdrawal amount');
      expect(normalizeHeaderForMatching('Debit')).toBe('debit');
      expect(normalizeHeaderForMatching('Debit Amount')).toBe('debit amount');
      expect(normalizeHeaderForMatching('Debit (Dr)')).toBe('debit');

      // Credit variations
      expect(normalizeHeaderForMatching('Deposit')).toBe('deposit');
      expect(normalizeHeaderForMatching('Deposit (Cr)')).toBe('deposit');
      expect(normalizeHeaderForMatching('Deposit (Cr.)')).toBe('deposit');
      expect(normalizeHeaderForMatching('Deposits')).toBe('deposit');
      expect(normalizeHeaderForMatching('Deposit Amt.')).toBe('deposit amount');
      expect(normalizeHeaderForMatching('Credit')).toBe('credit');
      expect(normalizeHeaderForMatching('Credit Amount')).toBe('credit amount');
      expect(normalizeHeaderForMatching('Credit (Cr)')).toBe('credit');

      // Balance variations
      expect(normalizeHeaderForMatching('Balance')).toBe('balance');
      expect(normalizeHeaderForMatching('Balance (INR)')).toBe('balance');
      expect(normalizeHeaderForMatching('Closing Balance')).toBe('closing balance');
      expect(normalizeHeaderForMatching('Running Balance')).toBe('running balance');
    });

    it('correctly ingests realistic bank statements with Withdrawal (Dr), Deposit (Cr), and Balance without dropping transactions', () => {
      const hdfcBankCsv = `Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal (Dr),Deposit (Cr),Closing Balance
01/04/2024,UPI/Swiggy/Order1234/Bengaluru,,01/04/2024,450.00,,49550.00
02/04/2024,SALARY CREDIT / INFOSYS LTD,,02/04/2024,,85000.00,134550.00
05/04/2024,ATM CASH WITHDRAWAL KORAMANGALA,,05/04/2024,10000.00,,124550.00
10/04/2024,UPI/ELECTRICITY BILL BESCOM,,10/04/2024,2450.50,,122099.50
15/04/2024,INTEREST CREDIT QUARTERLY,,15/04/2024,,620.00,122719.50
20/04/2024,NEFT/LANDLORD RENT BANGALORE,,20/04/2024,28000.00,,94719.50`;

      const parsed = parseUniversalBusinessData(hdfcBankCsv, 'hdfc_bank_statement.csv');
      expect(parsed.rows.length).toBe(6);

      // Verify Debits are negative
      const swiggyRow = parsed.rows.find((r) => r.description.includes('Swiggy'));
      expect(swiggyRow).toBeDefined();
      expect(swiggyRow?.amount).toBe('-450.00');
      expect(swiggyRow?.tran_type).toBe('DEBIT');

      const atmRow = parsed.rows.find((r) => r.description.includes('ATM CASH'));
      expect(atmRow).toBeDefined();
      expect(atmRow?.amount).toBe('-10000.00');
      expect(atmRow?.tran_type).toBe('DEBIT');

      const bescomRow = parsed.rows.find((r) => r.description.includes('BESCOM'));
      expect(bescomRow).toBeDefined();
      expect(bescomRow?.amount).toBe('-2450.50');

      const rentRow = parsed.rows.find((r) => r.description.includes('LANDLORD RENT'));
      expect(rentRow).toBeDefined();
      expect(rentRow?.amount).toBe('-28000.00');

      // Verify Credits are positive
      const salaryRow = parsed.rows.find((r) => r.description.includes('SALARY'));
      expect(salaryRow).toBeDefined();
      expect(salaryRow?.amount).toBe('85000.00');
      expect(salaryRow?.tran_type).toBe('CREDIT');

      const interestRow = parsed.rows.find((r) => r.description.includes('INTEREST'));
      expect(interestRow).toBeDefined();
      expect(interestRow?.amount).toBe('620.00');
      expect(interestRow?.tran_type).toBe('CREDIT');

      // Running balance (Closing Balance) should NOT be mistaken for transaction amounts
      expect(parsed.rows.some((r) => r.amount === '49550.00' || r.amount === '134550.00')).toBe(false);
    });

    it('supports Debit Amount, Credit Amount, and Balance headers', () => {
      const sbiBankCsv = `Txn Date,Description,Ref No.,Debit Amount,Credit Amount,Balance
12/05/2024,Amazon India Purchase,REF8472,1899.00,,38101.00
14/05/2024,Freelance Client Inflow,REF8473,,45000.00,83101.00
18/05/2024,Zomato Food Delivery,REF8474,620.00,,82481.00`;

      const parsed = parseUniversalBusinessData(sbiBankCsv, 'sbi_statement.csv');
      expect(parsed.rows.length).toBe(3);
      expect(parsed.rows[0]?.amount).toBe('-1899.00');
      expect(parsed.rows[1]?.amount).toBe('45000.00');
      expect(parsed.rows[2]?.amount).toBe('-620.00');
    });

    it('supports Withdrawals and Deposits plural headers', () => {
      const pluralCsv = `Date,Item,Withdrawals,Deposits,Balance
01/06/2024,Hardware Store Supplies,5400,,24600
05/06/2024,Cash Sales Deposit,,18500,43100`;

      const parsed = parseUniversalBusinessData(pluralCsv, 'plural_statement.csv');
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0]?.amount).toBe('-5400.00');
      expect(parsed.rows[1]?.amount).toBe('18500.00');
    });

    it('fully ingests realistic bank statements via ingestFilesDeterministically with correct archetype and facts', () => {
      const bankFile: RawIngestFile = {
        name: 'icici_bank_statement_fy2425.csv',
        mimeType: 'text/csv',
        content: `Transaction Date,Remarks,Withdrawal (Dr),Deposit (Cr),Balance (INR)
01/04/2024,Opening Deposit,,50000.00,50000.00
05/04/2024,Cloud Hosting AWS,4200.00,,45800.00
10/04/2024,Software Subscription,1500.00,,44300.00
15/04/2024,Client Retainer Invoice,,65000.00,109300.00
20/04/2024,Office Supplies Vendor,3800.00,,105500.00
25/04/2024,Freelance Payment Inflow,,20000.00,125500.00`,
      };

      const bundle = ingestFilesDeterministically([bankFile]);
      expect(bundle.transactions.length).toBe(6);
      expect(bundle.plan.business_meta?.archetype).toBe('bank_statement');
      expect(bundle.plan.business_meta?.currency_symbol).toBe('₹');

      // Verify no debits or credits dropped
      const debits = bundle.transactions.filter((t) => t.direction === 'out');
      const credits = bundle.transactions.filter((t) => t.direction === 'in');
      expect(debits.length).toBe(3);
      expect(credits.length).toBe(3);

      // Verify facts
      const factMap = new Map(bundle.facts.map((f) => [f.id, f]));
      expect(factMap.get('total_transactions_count')?.value).toBe(6);
      expect(factMap.get('total_income_usd')?.value).toBe(13500000); // 50k + 65k + 20k = 135k
      expect(factMap.get('total_spend_usd')?.value).toBe(950000); // 4.2k + 1.5k + 3.8k = 9.5k
    });
  });
});

