import { describe, expect, it } from 'vitest';
import { ingestFilesDeterministically } from '../pipeline/ingest-business.js';
import { computeFacts } from '../pipeline/compute-facts.js';
import { parseUniversalBusinessData } from '../pipeline/parse.js';
import type { RawIngestFile } from '../contracts/index.js';

describe('College Club Expense Register & PUPA Bills Ingestion (Improvements 1, 2, 3, 4)', () => {
  it('parses simulated PUPA 2025 multi-sheet expense register with 100% records preserved', () => {
    // Simulating CSV output from PUPA BILLS RECORD.xlsx Sheet 1 & Sheet 2
    const pupaExpensesCsv = `
PUPA 2025 - ANNUAL COLLEGE CULTURAL FESTIVAL BILLS RECORD
Committee: Cultural Affairs Council | Institution: Bengaluru Engineering College

Date,Bill No,Vendor,Item Description,Purchaser,Amount,Payment Mode,Status
10/02/2025,B-001,SoundCraft Systems,Stage Sound & Line Array Rental,Rahul Sharma,45000,Bank Transfer,Paid
12/02/2025,B-002,Shree Graphics Prints,Fest Banners Posters & Badges,Ananya Iyer,14500,UPI,Paid
14/02/2025,B-003,ProDJ Equipment Hub,Console & Lighting Truss Setup,Vikram Patel,28000,UPI,Pending
15/02/2025,B-004,Amrit Catering Services,Volunteer & Judge Lunch Boxes,Sneha Rao,18250,Cash,Paid
16/02/2025,B-005,Decathlon Sports India,Championship Trophies & Medals,Rahul Sharma,12400,Card,Paid
18/02/2025,B-006,Apollo Pharmacy Campus,Event First Aid & Medical Standby,Ananya Iyer,2850,UPI,Paid
20/02/2025,B-007,Local Generator Hire,Diesel Generator 62.5kVA 2 Days,Vikram Patel,16000,Cash,Pending
`.trim();

    const pupaSponsorshipCsv = `
PUPA 2025 - SPONSORSHIPS & STUDENT COUNCIL INFLOWS

Date,Counterparty,Department,Description,Amount,Currency,Status
05/01/2025,Student Welfare Fund,College Grant,Annual College Fest Budget Allotment,75000,INR,Cleared
15/01/2025,Red Bull India Pvt Ltd,Brand Sponsor,Energy Drink Zone Title Sponsor,40000,INR,Cleared
01/02/2025,Alumni Batch of 2015,Alumni Fund,Endowment for Battle of Bands Prize,25000,INR,Cleared
`.trim();

    const files: RawIngestFile[] = [
      {
        name: 'PUPA_BILLS_RECORD_Expenses.csv',
        mimeType: 'text/csv',
        content: pupaExpensesCsv,
        encoding: 'utf8',
      },
      {
        name: 'PUPA_BILLS_RECORD_Sponsorship.csv',
        mimeType: 'text/csv',
        content: pupaSponsorshipCsv,
        encoding: 'utf8',
      },
    ];

    const bundle = ingestFilesDeterministically(files, {
      entityName: 'PUPA 2025 Bills Record',
    });

    // 1. Archetype detection
    expect(bundle.plan.business_meta?.archetype).toBe('club_expense_register');
    expect(bundle.plan.person_name).toContain('PUPA');

    // 2. 100% records preserved (7 expense rows + 3 inflow rows = 10 total)
    expect(bundle.transactions.length).toBe(10);

    // 3. Evidence and Purchaser tracking preserved
    const rahulTxns = bundle.transactions.filter((t) => t.purchaser === 'Rahul Sharma');
    expect(rahulTxns.length).toBe(2);
    expect(rahulTxns.map((t) => t.amount_minor)).toEqual([4500000, 1240000]);

    const ananyaTxns = bundle.transactions.filter((t) => t.purchaser === 'Ananya Iyer');
    expect(ananyaTxns.length).toBe(2);

    // 4. Payment status tracking (Pending reimbursements are NEVER discarded)
    const pendingTxns = bundle.transactions.filter(
      (t) => t.payment_status?.toLowerCase() === 'pending'
    );
    expect(pendingTxns.length).toBe(2);
    const pendingSum = pendingTxns.reduce((acc, t) => acc + t.amount_minor, 0);
    expect(pendingSum).toBe(4400000); // 28000 + 16000 = 44,000 INR = 4,400,000 paise

    // 5. Currency standard is INR / ₹
    expect(bundle.transactions[0]!.currency).toBe('INR');

    // 6. Facts computation
    const facts = computeFacts(bundle.transactions, bundle.days, 2025, {
      isB2B: true,
      currencySymbol: '₹',
    });

    const topPurchaserFact = facts.find((f) => f.id === 'club_top_purchaser_name');
    expect(topPurchaserFact).toBeDefined();
    expect(topPurchaserFact?.value).toBe('Rahul Sharma');

    const topSpendFact = facts.find((f) => f.id === 'club_top_purchaser_spend');
    expect(topSpendFact).toBeDefined();
    expect(topSpendFact?.formatted).toContain('₹57,400'); // 45,000 + 12,400

    const pendingFact = facts.find((f) => f.id === 'reimbursement_pending_minor');
    expect(pendingFact).toBeDefined();
    expect(pendingFact?.formatted).toContain('₹44,000');

    const unpaidCountFact = facts.find((f) => f.id === 'unpaid_bills_count');
    expect(unpaidCountFact).toBeDefined();
    expect(unpaidCountFact?.value).toBe(2);

    const largestBillFact = facts.find((f) => f.id === 'largest_bill_minor');
    expect(largestBillFact).toBeDefined();
    // Largest inflow is 75000, largest expense is 45000
    expect(largestBillFact?.formatted).toContain('₹75,000');
  });

  it('handles irregular columns without standard date headers without dropping records', () => {
    const rawNoDateCsv = `
Voucher ID,Item,Vendor Name,Purchaser,Cost
VCH-01,Microphone cables,Bhatia Sound,Kunal,2500
VCH-02,Flex print banner,City Art,Rhea,8400
VCH-03,Stage duct tape & ties,Hardware Mart,Kunal,1200
`.trim();

    const parsed = parseUniversalBusinessData(rawNoDateCsv, 'Club_Vouchers.csv');
    expect(parsed.rows.length).toBe(3);
    expect(parsed.rows[0]?.purchaser).toBe('Kunal');
    expect(parsed.rows[1]?.purchaser).toBe('Rhea');
    // Default fallback dates assigned so records are valid
    expect(parsed.rows[0]?.date).toMatch(/^2025-01-\d{2}$/);
  });

  it('parses real-world PUPA BILLS RECORD format with Column1, DAY, and partial blank settlement', () => {
    const rawPupaActual = `
Date,DAY,Vendor name,Purchased By,Category,Column1,settlement
10/02/2025,Monday,SoundCraft Systems,Rahul Sharma,Sound,45000,paid
12/02/2025,Wednesday,Shree Graphics Prints,Ananya Iyer,Printing,14500,
14/02/2025,Friday,ProDJ Equipment Hub,Vikram Patel,Stage,28000,paid
15/02/2025,Saturday,Amrit Catering Services,Sneha Rao,Food,18250,
16/02/2025,Sunday,Decathlon Sports India,Rahul Sharma,Prizes,12400,paid
18/02/2025,Tuesday,Apollo Pharmacy Campus,Ananya Iyer,Medical,2850,
`.trim();

    const parsed = parseUniversalBusinessData(rawPupaActual, 'PUPA BILLS RECORD.csv');
    // All 6 rows must be parsed (none dropped due to blank settlement or Column1 amount header)
    expect(parsed.rows.length).toBe(6);

    // Verify amounts extracted from Column1
    expect(parsed.rows[0]?.amount).toBe('-45000.00');
    expect(parsed.rows[1]?.amount).toBe('-14500.00');
    expect(parsed.rows[2]?.amount).toBe('-28000.00');

    // Verify purchasers extracted
    expect(parsed.rows[0]?.purchaser).toBe('Rahul Sharma');
    expect(parsed.rows[1]?.purchaser).toBe('Ananya Iyer');

    // Verify partial settlement extracted without dropping blank settlement rows
    expect(parsed.rows[0]?.payment_status).toBe('paid');
    expect(parsed.rows[1]?.payment_status).toBeUndefined();

    // Verify full bundle ingestion & fact computation
    const files: RawIngestFile[] = [
      {
        name: 'PUPA BILLS RECORD.csv',
        mimeType: 'text/csv',
        content: rawPupaActual,
        encoding: 'utf8',
      },
    ];

    const bundle = ingestFilesDeterministically(files, { entityName: 'PUPA Fest Committee' });
    expect(bundle.transactions.length).toBe(6);
    expect(bundle.plan.business_meta?.archetype).toBe('club_expense_register');

    const facts = computeFacts(bundle.transactions, bundle.days, 2025, {
      isB2B: true,
      currencySymbol: '₹',
    });

    const topPurchaser = facts.find((f) => f.id === 'club_top_purchaser_name');
    expect(topPurchaser?.value).toBe('Rahul Sharma');

    const paidMinor = facts.find((f) => f.id === 'reimbursement_paid_minor');
    expect(paidMinor?.formatted).toContain('₹85,400'); // 45000 + 28000 + 12400 = 85,400
  });

  it('supports raw Excel serial dates in Date column (e.g. 45698 -> 2025-02-10)', () => {
    const rawExcelSerialCsv = `
Date,Vendor name,Purchased By,Category,Column1,settlement
45698,Bhatia Sound,Kunal,Audio,15000,paid
45700,City Art Flex,Rhea,Banners,8400,
`.trim();

    const parsed = parseUniversalBusinessData(rawExcelSerialCsv, 'PUPA_Serial_Dates.csv');
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]?.date).toBe('2025-02-10');
    expect(parsed.rows[0]?.amount).toBe('-15000.00');
  });
});
