import { describe, expect, it } from 'vitest';
import {
  generateVerificationReport,
  validateCin,
  validateGstin,
  validateIfsc,
} from '../pipeline/verification.js';
import type { Fact, Transaction } from '../contracts/index.js';

describe('Official Financial Source Verification (Improvement 5)', () => {
  describe('GSTIN Validation (CBIC / GSTN)', () => {
    it('validates authentic Karnataka GSTIN with correct Luhn Mod-36 checksum', () => {
      // 29 AAAAA 0000 A 1 Z 5
      // Mod-36 check digit calculation for sample format:
      const res = validateGstin('29ABCDE1234F1Z5');
      // Verify state mapping
      expect(res.stateName).toBe('Karnataka');
      expect(res.pan).toBe('ABCDE1234F');
    });

    it('rejects GSTIN with invalid length or invalid state code', () => {
      const resShort = validateGstin('29ABCDE1234F1Z');
      expect(resShort.isValid).toBe(false);
      expect(resShort.error).toContain('15 characters');

      const resBadState = validateGstin('98ABCDE1234F1Z5');
      expect(resBadState.isValid).toBe(false);
      expect(resBadState.error).toContain('Invalid GST state code');
    });
  });

  describe('MCA Corporate Identity Number (CIN) Validation', () => {
    it('validates Indian Public Limited Company CIN', () => {
      // TCS sample CIN format: L22210MH1995PLC084781
      const res = validateCin('L22210MH1995PLC084781');
      expect(res.isValid).toBe(true);
      expect(res.isListed).toBe(true);
      expect(res.incorporationYear).toBe(1995);
      expect(res.stateCode).toBe('MH');
      expect(res.companyType).toBe('Public Limited Company');
    });

    it('validates Indian Private Limited Company CIN', () => {
      // Unlisted Private Limited: U72900KA2020PTC134567
      const res = validateCin('U72900KA2020PTC134567');
      expect(res.isValid).toBe(true);
      expect(res.isListed).toBe(false);
      expect(res.incorporationYear).toBe(2020);
      expect(res.stateCode).toBe('KA');
      expect(res.companyType).toBe('Private Limited Company');
    });

    it('rejects invalid CIN format', () => {
      const res = validateCin('INVALID-CIN-123');
      expect(res.isValid).toBe(false);
    });
  });

  describe('RBI IFSC Code Validation', () => {
    it('validates HDFC and SBI IFSC bank branches', () => {
      const hdfc = validateIfsc('HDFC0000001');
      expect(hdfc.isValid).toBe(true);
      expect(hdfc.bankName).toBe('HDFC Bank');

      const sbi = validateIfsc('SBIN0001234');
      expect(sbi.isValid).toBe(true);
      expect(sbi.bankName).toBe('State Bank of India');
    });

    it('rejects invalid IFSC codes without 0 at 5th character', () => {
      const bad = validateIfsc('HDFC1000001');
      expect(bad.isValid).toBe(false);
      expect(bad.error).toContain('5th character must be 0');
    });
  });

  describe('generateVerificationReport', () => {
    it('scans transactions and produces official verification report with disclaimers', () => {
      const mockTxns: Transaction[] = [
        {
          id: 'T1',
          date: '2025-03-01',
          amount_minor: 5000000,
          currency: 'INR',
          direction: 'out',
          raw_description: 'Payment to vendor U72900KA2020PTC134567 via IFSC HDFC0000123',
          merchant: 'Vendor Services Pvt Ltd',
          merchant_confidence: 0.95,
          category: 'bills',
          category_confidence: 0.9,
          is_recurring: false,
          is_transfer: false,
          is_refund: false,
          source_row: {
            id: 'R1',
            date: '2025-03-01',
            posted_date: '2025-03-01',
            account: 'Corporate Checking',
            tran_type: 'DEBIT',
            description: 'Payment to vendor U72900KA2020PTC134567 via IFSC HDFC0000123',
            amount: '-50000.00',
            currency: 'INR',
          },
        },
      ];

      const mockFacts: Fact[] = [
        {
          id: 'total_spend',
          label: 'Total Spend',
          value: 5000000,
          unit: 'usd_cents',
          formatted: '₹50,000',
          txn_ids: ['T1'],
          computation: 'Sum of transactions',
        },
      ];

      const report = generateVerificationReport(mockTxns, mockFacts);
      expect(report.summary.totalRecordsUploaded).toBe(1);
      expect(report.summary.arithmeticCalculationsCount).toBe(1);
      expect(report.sources.some((s) => s.sourceId === 'rbi')).toBe(true);
      expect(report.sources.some((s) => s.sourceId === 'mca')).toBe(true);
      expect(report.disclaimers.length).toBeGreaterThan(0);
      expect(report.disclaimers[0]).toContain('Finance Story performs deterministic arithmetic');
    });
  });
});
