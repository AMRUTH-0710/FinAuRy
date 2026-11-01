/**
 * Universal Financial Schema Inference Engine (`pipeline/schema-inference.ts`)
 *
 * Inspects file structure, sheet names, headers, data types, sample values,
 * and semantic relationships between columns.
 *
 * Automatically infers:
 * - Document type (club expense register, sales ledger, cashbook, bank statement, P&L, general ledger)
 * - Semantic roles for every column (date, amount, debit, credit, vendor, purchaser, category, status, etc.)
 * - Generic column headers (Column1, Unnamed: 5, Field1, Particulars) by contextual value inspection
 * - Assigns confidence ratings and provides verifiable evidence
 */

import type {
  BusinessArchetype,
  ColumnRole,
  DataConfidenceAmbiguity,
  DataConfidenceReport,
  IndianAccountingFramework,
  InferredColumn,
  InferredDocumentSchema,
  RawSourceRow,
} from '../contracts/index.js';

const DAY_OF_WEEK_REGEX = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)$/i;
const STATUS_KEYWORDS_REGEX = /^(paid|pending|cleared|settled|unpaid|due|approved|rejected|partially[\s_-]*paid|reimbursed|in[\s_-]*process)$/i;
const PAYMENT_MODE_REGEX = /^(upi|cash|card|debit[\s_-]*card|credit[\s_-]*card|net[\s_-]*banking|neft|rtgs|imps|cheque|check|bank[\s_-]*transfer|wire|dd|draft)$/i;

export interface ColumnValueInspection {
  totalNonEmpty: number;
  excelDateCount: number;
  textDateCount: number;
  dayOfWeekCount: number;
  numericCount: number;
  currencyCount: number;
  statusCount: number;
  paymentModeCount: number;
  idCodeCount: number;
  sampleValues: string[];
}

/**
 * Normalizes a header text by trimming, collapsing spaces, and stripping punctuation
 */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s*\((?:dr\.?|cr\.?|inr|rs\.?|₹|\$|usd|eur|gbp)\)\s*/gi, ' ')
    .replace(/\s*\[(?:dr\.?|cr\.?|inr|rs\.?|₹|\$|usd|eur|gbp)\]\s*/gi, ' ')
    .replace(/[_\s\-\\]+/g, ' ')
    .replace(/\//g, ' ')
    .trim();
}

/**
 * Inspects sample cell values in a column to determine data type distributions
 */
export function inspectColumnValues(
  colIndex: number,
  rows: readonly string[][]
): ColumnValueInspection {
  let totalNonEmpty = 0;
  let excelDateCount = 0;
  let textDateCount = 0;
  let dayOfWeekCount = 0;
  let numericCount = 0;
  let currencyCount = 0;
  let statusCount = 0;
  let paymentModeCount = 0;
  let idCodeCount = 0;
  const sampleValues: string[] = [];

  const maxSampleRows = Math.min(rows.length, 50);

  for (let r = 0; r < maxSampleRows; r++) {
    const rawVal = rows[r]?.[colIndex];
    if (rawVal === undefined || rawVal === null) continue;
    const val = String(rawVal).trim().replace(/^["']|["']$/g, '').trim();
    if (!val || val === '-' || val === '—' || val.toLowerCase() === 'null' || val.toLowerCase() === 'n/a') {
      continue;
    }

    totalNonEmpty++;
    if (sampleValues.length < 5) {
      sampleValues.push(val);
    }

    // 1. Day of week
    if (DAY_OF_WEEK_REGEX.test(val)) {
      dayOfWeekCount++;
      continue;
    }

    // 2. Status flag
    if (STATUS_KEYWORDS_REGEX.test(val)) {
      statusCount++;
    }

    // 3. Payment mode
    if (PAYMENT_MODE_REGEX.test(val)) {
      paymentModeCount++;
    }

    // 4. Excel Serial Date (numbers between 25000 and 75000: years ~1968 to 2105)
    if (/^\d{5}(?:\.\d+)?$/.test(val)) {
      const serial = Number(val);
      if (serial >= 25000 && serial <= 75000) {
        excelDateCount++;
      }
    }

    // 5. Standard Text Date
    if (
      /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(val) ||
      /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(val) ||
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.-]+\d{1,2}/i.test(val) ||
      /^\d{1,2}[\s,.-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(val)
    ) {
      textDateCount++;
    }

    // 6. Currency symbol
    if (/₹|\$|€|£|¥|\b(inr|rs\.?|usd|eur|gbp)\b/i.test(val)) {
      currencyCount++;
    }

    // 7. Numeric amount
    const cleanedNum = val
      .replace(/₹|\$|€|£|¥|\b(inr|rs\.?|usd|eur|gbp)\b/gi, '')
      .replace(/,/g, '')
      .trim();
    if (/^-?\d+(?:\.\d+)?$/.test(cleanedNum) || /^\(\d+(?:\.\d+)?\)$/.test(cleanedNum)) {
      numericCount++;
    }

    // 8. Bill / Voucher code
    if (/^(bill|inv|voucher|rec|vch|ref|txn)[\s#._-]*[a-z0-9-]+$/i.test(val)) {
      idCodeCount++;
    }
  }

  return {
    totalNonEmpty,
    excelDateCount,
    textDateCount,
    dayOfWeekCount,
    numericCount,
    currencyCount,
    statusCount,
    paymentModeCount,
    idCodeCount,
    sampleValues,
  };
}

/**
 * Infers semantic role for a single column based on header text and sample values
 */
export function inferColumnRole(
  colIndex: number,
  rawHeader: string,
  stats: ColumnValueInspection,
  _totalColumns: number
): { role: ColumnRole; confidence: number; evidence: string } {
  const norm = normalizeHeader(rawHeader).toLowerCase();
  const sampleRatio = stats.totalNonEmpty > 0 ? stats.totalNonEmpty : 1;

  // 1. Check for Day of Week (e.g. 'DAY' header with Monday, Tuesday)
  if (
    norm === 'day' ||
    norm === 'weekday' ||
    norm === 'day of week' ||
    (stats.dayOfWeekCount / sampleRatio >= 0.7 && norm !== 'date')
  ) {
    return {
      role: 'day_of_week',
      confidence: 0.95,
      evidence: `Identified as Day of Week: Header "${rawHeader}" with ${stats.dayOfWeekCount} weekday values`,
    };
  }

  // 2. Check for Date
  const dateHeaderPattern = /^(date|bill[\s_-]*date|txn[\s_-]*date|transaction[\s_-]*date|invoice[\s_-]*date|purchase[\s_-]*date|payment[\s_-]*date|period|booking[\s_-]*date)$/i;
  const isDateHeader = dateHeaderPattern.test(norm) || (/\bdate\b/i.test(norm) && norm !== 'date of birth');
  const dateValuesCount = stats.textDateCount + stats.excelDateCount;
  const dateRatio = dateValuesCount / sampleRatio;

  if (isDateHeader || dateRatio >= 0.6) {
    const isExcelDate = stats.excelDateCount > stats.textDateCount;
    return {
      role: 'date',
      confidence: isDateHeader && dateRatio > 0 ? 0.98 : 0.85,
      evidence: `Identified as Date: Header "${rawHeader}", ${dateValuesCount}/${stats.totalNonEmpty} sample dates (${isExcelDate ? 'Excel numeric dates' : 'calendar dates'})`,
    };
  }

  // 3. Check for Purchaser / Person
  const purchaserHeaderPattern = /^(purchased[\s_-]*by|purchaser|buyer|bought[\s_-]*by|spent[\s_-]*by|student[\s_-]*name|member|person|coordinator|claimant|submitted[\s_-]*by)$/i;
  if (purchaserHeaderPattern.test(norm)) {
    return {
      role: 'purchaser',
      confidence: 0.95,
      evidence: `Identified as Purchaser / Coordinator: Header "${rawHeader}" matching purchaser patterns`,
    };
  }

  // 4. Check for Settlement / Status
  const statusHeaderPattern = /^(settlement|status|bill[\s_-]*status|payment[\s_-]*status|reimbursement[\s_-]*status|approval[\s_-]*status)$/i;
  const isStatusHeader = statusHeaderPattern.test(norm);
  const statusRatio = stats.statusCount / sampleRatio;
  if (isStatusHeader || statusRatio >= 0.4) {
    return {
      role: 'status',
      confidence: isStatusHeader ? 0.95 : 0.8,
      evidence: `Identified as Payment Status: Header "${rawHeader}" with status flags (${stats.sampleValues.join(', ') || 'paid/pending'})`,
    };
  }

  // 5. Check for Payment Mode
  const modeHeaderPattern = /^(payment[\s_-]*mode|mode[\s_-]*of[\s_-]*payment|mode|method|payment[\s_-]*method|instrument)$/i;
  const isModeHeader = modeHeaderPattern.test(norm);
  const modeRatio = stats.paymentModeCount / sampleRatio;
  if (isModeHeader || modeRatio >= 0.4) {
    return {
      role: 'payment_mode',
      confidence: isModeHeader ? 0.95 : 0.8,
      evidence: `Identified as Payment Mode: Header "${rawHeader}" with payment instruments (${stats.sampleValues.join(', ')})`,
    };
  }

  // 6. Check for Vendor / Counterparty
  const vendorHeaderPattern = /^(vendor|vendor[\s_-]*name|shop|store|merchant|supplier|payee|counterparty|firm|company|party)$/i;
  if (vendorHeaderPattern.test(norm)) {
    return {
      role: 'vendor',
      confidence: 0.95,
      evidence: `Identified as Vendor / Merchant: Header "${rawHeader}"`,
    };
  }

  // 7. Check for Category / Department
  const categoryHeaderPattern = /^(category|department|dept|expense[\s_-]*type|cost[\s_-]*center|gl[\s_-]*account|classification|stream|head)$/i;
  if (categoryHeaderPattern.test(norm)) {
    return {
      role: 'category',
      confidence: 0.95,
      evidence: `Identified as Category: Header "${rawHeader}"`,
    };
  }

  // 8. Check for Bill / Invoice Number
  const billNoHeaderPattern = /^(bill[\s_-]*no|bill[\s_-]*number|invoice[\s_-]*no|receipt[\s_-]*no|voucher[\s_-]*no|ref[\s_-]*no)$/i;
  if (billNoHeaderPattern.test(norm) || (stats.idCodeCount / sampleRatio >= 0.5)) {
    return {
      role: 'bill_no',
      confidence: 0.9,
      evidence: `Identified as Bill / Invoice Number: Header "${rawHeader}"`,
    };
  }

  // 9. Check for Debit, Credit, and Balance columns first
  const normClean = norm
    .replace(/\bwithdrawals\b/g, 'withdrawal')
    .replace(/\bdeposits\b/g, 'deposit')
    .replace(/\bdebits\b/g, 'debit')
    .replace(/\bcredits\b/g, 'credit');

  if (
    /\b(debit|dr|cash[\s_-]*paid|money[\s_-]*paid|paid[\s_-]*out|withdrawal)\b/i.test(norm) ||
    /\b(debit|dr|withdrawal)\b/i.test(normClean) ||
    /^paid$/i.test(norm)
  ) {
    return { role: 'debit', confidence: 0.95, evidence: `Identified as Debit column: Header "${rawHeader}"` };
  }
  if (
    /\b(credit|cr|cash[\s_-]*received|money[\s_-]*received|paid[\s_-]*in|deposit|receipts?)\b/i.test(norm) ||
    /\b(credit|cr|deposit|receipt)\b/i.test(normClean) ||
    /^received$/i.test(norm)
  ) {
    return { role: 'credit', confidence: 0.95, evidence: `Identified as Credit column: Header "${rawHeader}"` };
  }
  if (
    /\b(balance|closing[\s_-]*balance|opening[\s_-]*balance|running[\s_-]*balance|available[\s_-]*balance)\b/i.test(norm) ||
    /\bbalance\b/i.test(normClean)
  ) {
    return { role: 'balance', confidence: 0.9, evidence: `Identified as Balance column: Header "${rawHeader}"` };
  }

  // 10. Check for Amount (explicit header OR generic headers like Column1 / Unnamed: 5 with numeric content)
  const amountHeaderPattern = /^(amount|total|price|cost|spend|expense|expenditure|inr|rs\.?|value|net)$/i;
  const isAmountHeader = amountHeaderPattern.test(norm) || /\b(amount|price|cost|spend|expense|total)\b/i.test(norm);
  const isGenericHeader = /^(column\s*\d+|unnamed(?::\s*\d+)?|field\s*\d+|var\s*\d+|_c\d+|\s*)$/i.test(norm);
  const numericRatio = stats.numericCount / sampleRatio;

  if (isAmountHeader) {
    return {
      role: 'amount',
      confidence: 0.96,
      evidence: `Identified as Amount: Explicit header "${rawHeader}"`,
    };
  }

  // Generic header with numeric content (e.g. Column1 in PUPA BILLS RECORD)
  if ((isGenericHeader || norm.length <= 8) && numericRatio >= 0.5 && stats.excelDateCount === 0) {
    return {
      role: 'amount',
      confidence: isGenericHeader ? 0.9 : 0.75,
      evidence: `Inferred Amount from generic header "${rawHeader}": ${stats.numericCount}/${stats.totalNonEmpty} sample values are numbers (${stats.sampleValues.join(', ')})`,
    };
  }

  // 10. Check for Description / Item / Particulars
  const descHeaderPattern = /^(description|particulars|item|items|item[\s_-]*name|details|purpose|memo|narrative|note|remarks)$/i;
  if (descHeaderPattern.test(norm)) {
    return {
      role: 'description',
      confidence: 0.95,
      evidence: `Identified as Description / Item: Header "${rawHeader}"`,
    };
  }

  // Default fallback based on column characteristics
  if (numericRatio >= 0.75 && stats.excelDateCount === 0 && colIndex >= 1) {
    return {
      role: 'amount',
      confidence: 0.82,
      evidence: `Inferred Amount from numeric content: ${stats.numericCount}/${stats.totalNonEmpty} numeric values (${stats.sampleValues.join(', ')})`,
    };
  }

  return {
    role: 'description',
    confidence: 0.5,
    evidence: `Fallback text column: Header "${rawHeader}"`,
  };
}

/**
 * Full schema inference over headers and sample rows
 */
export function inferDocumentSchema(
  headers: string[],
  rows: readonly string[][],
  fileName = 'document'
): InferredDocumentSchema {
  const normHeaders = headers.map(normalizeHeader);
  const columns: InferredColumn[] = [];

  for (let c = 0; c < normHeaders.length; c++) {
    const rawH = headers[c] || `Column${c + 1}`;
    const stats = inspectColumnValues(c, rows);
    const { role, confidence, evidence } = inferColumnRole(c, rawH, stats, normHeaders.length);
    columns.push({
      index: c,
      header: rawH,
      role,
      confidence,
      evidence,
      sampleValues: stats.sampleValues,
    });
  }

  // Resolve conflicts: Ensure exactly one primary date column and one primary amount/debit-credit
  const dateCols = columns.filter((c) => c.role === 'date');
  let dateColIndex = -1;
  if (dateCols.length === 1) {
    dateColIndex = dateCols[0]!.index;
  } else if (dateCols.length > 1) {
    // Pick the one with highest confidence or earliest column
    dateCols.sort((a, b) => b.confidence - a.confidence || a.index - b.index);
    dateColIndex = dateCols[0]!.index;
    for (let i = 1; i < dateCols.length; i++) {
      dateCols[i]!.role = 'posted_date';
    }
  }

  const amountCols = columns.filter((c) => c.role === 'amount');
  let amountColIndex = -1;
  if (amountCols.length === 1) {
    amountColIndex = amountCols[0]!.index;
  } else if (amountCols.length > 1) {
    amountCols.sort((a, b) => b.confidence - a.confidence);
    amountColIndex = amountCols[0]!.index;
  }

  const debitCol = columns.find((c) => c.role === 'debit');
  const creditCol = columns.find((c) => c.role === 'credit');
  const purchaserCol = columns.find((c) => c.role === 'purchaser');
  const statusCol = columns.find((c) => c.role === 'status');
  const vendorCol = columns.find((c) => c.role === 'vendor');
  const categoryCol = columns.find((c) => c.role === 'category');
  const descCol = columns.find((c) => c.role === 'description');

  // Fallback amount resolution if not detected yet: scan remaining non-date columns for numbers
  if (amountColIndex === -1 && !debitCol && !creditCol) {
    let bestNumCol = -1;
    let maxNums = 0;
    for (let c = 0; c < headers.length; c++) {
      if (c === dateColIndex) continue;
      const stats = inspectColumnValues(c, rows);
      if (stats.numericCount > maxNums && stats.numericCount >= Math.min(rows.length, 2)) {
        maxNums = stats.numericCount;
        bestNumCol = c;
      }
    }
    if (bestNumCol !== -1) {
      amountColIndex = bestNumCol;
      columns[bestNumCol]!.role = 'amount';
      columns[bestNumCol]!.confidence = 0.85;
      columns[bestNumCol]!.evidence = `Inferred Amount from numeric values`;
    }
  }

  // Infer Document Archetype
  const fullTextContext = `${fileName} ${headers.join(' ')}`.toLowerCase();
  let documentType: BusinessArchetype = 'general_ledger';
  const evidence: string[] = [];

  if (
    purchaserCol ||
    /pupa|club|fest|reimbursement|committee|council|student|campus/i.test(fullTextContext)
  ) {
    documentType = 'club_expense_register';
    evidence.push('Detected club/event expense register with coordinator purchasers and reimbursement settlement tracking');
  } else if (/cashbook|petty[\s_-]*cash/i.test(fullTextContext)) {
    documentType = 'cashbook';
    evidence.push('Detected cashbook tracking money received, paid, and cash balances');
  } else if (debitCol && creditCol) {
    documentType = 'bank_statement';
    evidence.push('Detected paired debit and credit columns typical of bank statements or accounting ledgers');
  } else if (/p&l|profit[\s_-]*and[\s_-]*loss|income[\s_-]*statement/i.test(fullTextContext)) {
    documentType = 'enterprise_pnl';
    evidence.push('Detected profit and loss statement with financial reporting categories');
  } else if (/sales|invoice|revenue|gmv/i.test(fullTextContext)) {
    documentType = 'sales_ledger';
    evidence.push('Detected sales or revenue ledger with commercial transaction records');
  }

  const unresolvedFields: string[] = [];
  if (dateColIndex === -1) unresolvedFields.push('date');
  if (amountColIndex === -1 && !debitCol && !creditCol) unresolvedFields.push('amount');

  return {
    documentType,
    confidence: unresolvedFields.length === 0 ? 0.95 : 0.6,
    columns,
    dateColIndex,
    amountColIndex,
    ...(debitCol ? { debitColIndex: debitCol.index } : {}),
    ...(creditCol ? { creditColIndex: creditCol.index } : {}),
    ...(purchaserCol ? { purchaserColIndex: purchaserCol.index } : {}),
    ...(statusCol ? { statusColIndex: statusCol.index } : {}),
    ...(vendorCol ? { vendorColIndex: vendorCol.index } : {}),
    ...(categoryCol ? { categoryColIndex: categoryCol.index } : {}),
    ...(descCol ? { descColIndex: descCol.index } : {}),
    currency: 'INR',
    unresolvedFields,
    evidence,
  };
}

/**
 * Maps the inferred document archetype to the appropriate Indian Financial & Accounting Framework.
 * Strictly prevents applying corporate Schedule III / Ind AS rules to personal or club records.
 */
export function inferIndianAccountingFramework(
  archetype: BusinessArchetype,
  contextText = ''
): { framework: IndianAccountingFramework; standardLabel: string; regulatoryBody: string; legalCitations: string[] } {
  const ctx = contextText.toLowerCase();

  if (archetype === 'consumer_personal' || /personal|individual|upi|salary/i.test(ctx)) {
    return {
      framework: 'personal_informal_ledger',
      standardLabel: 'Personal Cash Flow Management (Informal Ledger)',
      regulatoryBody: 'Informal Budgeting / Personal Cash Tracking',
      legalCitations: [
        'Non-Statutory: Informal Personal Expense & Budget Tracking (Voluntary Record Keeping)',
        'RBI Guidelines on Safe Digital Payments & UPI Transaction Hygiene',
      ],
    };
  }

  if (archetype === 'club_expense_register' || /club|fest|college|council|society|committee/i.test(ctx)) {
    return {
      framework: 'club_receipts_payments',
      standardLabel: 'Non-Profit / Institutional Receipts & Payments Framework',
      regulatoryBody: 'ICAI Guidance Note on Accounting by Non-Profit Organizations',
      legalCitations: [
        'ICAI Guidance on Receipts & Payments Accounts for Student & Voluntary Bodies',
        'Standard on Internal Audit (SIA) 310: Internal Controls over Event Reimbursements',
      ],
    };
  }

  if (
    archetype === 'cashbook' ||
    archetype === 'sales_ledger' ||
    archetype === 'general_ledger' ||
    /small[\s_-]*business|proprietor|partnership|msme|trader/i.test(ctx)
  ) {
    return {
      framework: 'micro_business_as',
      standardLabel: 'ICAI Accounting Standards for MSMEs & Non-Corporates (AS 1, 3, 9)',
      regulatoryBody: 'Institute of Chartered Accountants of India (ICAI) / MSMED Act',
      legalCitations: [
        'ICAI AS 1: Disclosure of Accounting Policies (MSME/Non-Corporate Level II/III/IV Entities)',
        'ICAI AS 9: Revenue Recognition',
        'Statutory Tax Audit Provision (NOT an Accounting Standard): Section 44AB of the Income Tax Act, 1961 applies only when business turnover exceeds statutory thresholds (₹1 Cr or ₹10 Cr if cash transactions <= 5%)',
      ],
    };
  }

  return {
    framework: 'corporate_ind_as_schedule_iii',
    standardLabel: 'Companies Act 2013 Schedule III Division II & Indian Accounting Standards (Ind AS)',
    regulatoryBody: 'Ministry of Corporate Affairs (MCA) / National Financial Reporting Authority (NFRA)',
    legalCitations: [
      'Companies Act, 2013 Section 129 & 133 (Schedule III Division II)',
      'Ind AS 1: Presentation of Financial Statements',
      'Ind AS 7: Statement of Cash Flows',
      'Ind AS 115: Revenue from Contracts with Customers',
    ],
  };
}

/**
 * Validates data confidence internally without demanding a separate intrusive dashboard.
 * Evaluates:
 * - Inferred field completeness and confidence
 * - Missing values (empty dates, descriptions, or zero amounts)
 * - Ambiguous dates (e.g. DD/MM vs MM/DD ambiguity)
 * - Currencies consistency
 * - Duplicate records (exact date, description, and amount matches)
 * - Highlights ambiguities only when critical ambiguity impacts results.
 */
export function validateDataConfidence(
  rawRows: readonly RawSourceRow[],
  schema: InferredDocumentSchema
): DataConfidenceReport {
  let missingValueCount = 0;
  let ambiguousDatesCount = 0;
  const ambiguities: DataConfidenceAmbiguity[] = [];
  const duplicateTxnIds: string[] = [];

  const seenRowKeys = new Map<string, string>();
  const currenciesSeen = new Set<string>();

  for (const row of rawRows) {
    if (row.currency) {
      currenciesSeen.add(row.currency.toUpperCase());
    }

    // Check missing values
    if (!row.date || row.date.trim() === '') {
      missingValueCount++;
      ambiguities.push({
        field: 'date',
        issue: 'Row is missing a transaction date',
        severity: 'warning',
        recordId: row.id,
        requiresUserClarification: false,
      });
    }

    if (!row.amount || row.amount.trim() === '') {
      missingValueCount++;
      ambiguities.push({
        field: 'amount',
        issue: 'Row is missing an amount value',
        severity: 'warning',
        recordId: row.id,
        requiresUserClarification: false,
      });
    }

    // Check date ambiguity: DD/MM/YYYY vs MM/DD/YYYY when both parts <= 12
    if (row.date) {
      const match = row.date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (match) {
        const p1 = Number.parseInt(match[1]!, 10);
        const p2 = Number.parseInt(match[2]!, 10);
        if (p1 <= 12 && p2 <= 12 && p1 !== p2) {
          ambiguousDatesCount++;
        }
      }
    }

    // Duplicate detection: exact date, description/counterparty, and amount
    const cleanDesc = (row.description || '').trim().toLowerCase();
    const cleanAmt = (row.amount || '').trim();
    const cleanDate = (row.date || '').trim();
    if (cleanDate && cleanAmt) {
      const rowKey = `${cleanDate}__${cleanAmt}__${cleanDesc}`;
      if (seenRowKeys.has(rowKey)) {
        duplicateTxnIds.push(row.id);
      } else {
        seenRowKeys.set(rowKey, row.id);
      }
    }
  }

  const inferredFieldCount = schema.columns.filter((c) => c.role !== 'ignored').length;
  const currencyConsistency = currenciesSeen.size <= 1;
  const primaryCurrency = currenciesSeen.size > 0 ? Array.from(currenciesSeen)[0]! : 'INR';

  if (!currencyConsistency) {
    ambiguities.push({
      field: 'currency',
      issue: `Mixed currencies detected in uploaded data: ${Array.from(currenciesSeen).join(', ')}`,
      severity: 'warning',
      requiresUserClarification: false,
    });
  }

  if (schema.unresolvedFields.length > 0) {
    ambiguities.push({
      field: schema.unresolvedFields.join(', '),
      issue: `Key financial fields (${schema.unresolvedFields.join(', ')}) could not be resolved with high confidence`,
      severity: 'warning',
      requiresUserClarification: true,
    });
  }

  // Calculate overall score out of 100
  let score = 100;
  score -= Math.min(25, missingValueCount * 5);
  score -= Math.min(20, duplicateTxnIds.length * 4);
  score -= Math.min(15, schema.unresolvedFields.length * 10);
  if (!currencyConsistency) score -= 10;
  score = Math.max(20, score);

  return {
    overallScore: score,
    inferredFieldCount,
    missingValueCount,
    ambiguousDatesCount,
    duplicateCount: duplicateTxnIds.length,
    duplicateTxnIds,
    parsingConfidence: schema.confidence,
    currencyConsistency,
    primaryCurrency,
    ambiguities,
  };
}

