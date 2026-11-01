/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import type { RawIngestFile } from '../contracts/index.js';
import { parseCsvLine } from '../pipeline/parse.js';
import { isXlsxBytes, parseXlsxTabs } from '../pipeline/xlsx.js';
import { processByoIngestion, readBrowserFiles } from './ingest/index.js';

type TabType = 'upload' | 'drive' | 'sample';

export type FileType = 'csv' | 'xlsx' | 'json' | 'pdf' | 'tsv' | 'txt' | 'generic';

export interface FilePreviewData {
  fileName: string;
  fileType: FileType;
  fileSizeFormatted?: string;
  sheetName?: string;
  totalRows: number;
  totalColumns: number;
  headers: string[];
  rows: string[][];
  truncatedCount: number;
}

export function getFileType(fileName?: string | null, statusText?: string | null): FileType {
  const target = (fileName || statusText || '').toLowerCase();
  if (!target) return 'generic';
  if (target.endsWith('.csv') || target.includes('.csv')) return 'csv';
  if (
    target.endsWith('.xlsx') ||
    target.endsWith('.xls') ||
    target.includes('.xlsx') ||
    target.includes('.xls')
  ) {
    return 'xlsx';
  }
  if (target.endsWith('.json') || target.includes('.json')) return 'json';
  if (target.endsWith('.pdf') || target.includes('.pdf')) return 'pdf';
  if (target.endsWith('.tsv') || target.includes('.tsv')) return 'tsv';
  if (target.endsWith('.txt') || target.includes('.txt')) return 'txt';
  return 'generic';
}

export function FileTypeIcon({ type }: { type: FileType }): React.JSX.Element {
  switch (type) {
    case 'csv':
      return (
        <span
          className="inline-flex items-center gap-1.5 flex-shrink-0 text-emerald-400"
          data-file-type="csv"
          data-testid="file-type-icon"
          id="file-type-icon"
          title="CSV Delimited Dataset"
        >
          <svg
            aria-label="CSV file icon"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 13h2" />
            <path d="M8 17h8" />
            <path d="M14 13h2" />
          </svg>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 tracking-wider">
            CSV
          </span>
        </span>
      );

    case 'xlsx':
      return (
        <span
          className="inline-flex items-center gap-1.5 flex-shrink-0 text-green-400"
          data-file-type="xlsx"
          data-testid="file-type-icon"
          id="file-type-icon"
          title="Excel Workbook"
        >
          <svg
            aria-label="XLSX spreadsheet icon"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <rect height="6" rx="1" width="8" x="8" y="12" />
            <line x1="8" x2="16" y1="15" y2="15" />
            <line x1="12" x2="12" y1="12" y2="18" />
          </svg>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech font-extrabold uppercase bg-green-500/20 text-green-300 border border-green-400/40 tracking-wider">
            XLSX
          </span>
        </span>
      );

    case 'json':
      return (
        <span
          className="inline-flex items-center gap-1.5 flex-shrink-0 text-amber-400"
          data-file-type="json"
          data-testid="file-type-icon"
          id="file-type-icon"
          title="JSON Data Structure"
        >
          <svg
            aria-label="JSON data icon"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
            <path d="M14 12a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1 1 1 0 0 0-1 1v1a1 1 0 0 1-1 1" />
          </svg>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/40 tracking-wider">
            JSON
          </span>
        </span>
      );

    case 'pdf':
      return (
        <span
          className="inline-flex items-center gap-1.5 flex-shrink-0 text-rose-400"
          data-file-type="pdf"
          data-testid="file-type-icon"
          id="file-type-icon"
          title="PDF Document"
        >
          <svg
            aria-label="PDF file icon"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13v4" />
            <path d="M9 13h2a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9" />
            <path d="M15 13h-2v4" />
          </svg>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-400/40 tracking-wider">
            PDF
          </span>
        </span>
      );

    case 'tsv':
    case 'txt':
      return (
        <span
          className="inline-flex items-center gap-1.5 flex-shrink-0 text-sky-400"
          data-file-type={type}
          data-testid="file-type-icon"
          id="file-type-icon"
          title={`${type.toUpperCase()} File`}
        >
          <svg
            aria-label={`${type.toUpperCase()} file icon`}
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" x2="16" y1="13" y2="13" />
            <line x1="8" x2="14" y1="17" y2="17" />
          </svg>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech font-extrabold uppercase bg-sky-500/20 text-sky-300 border border-sky-400/40 tracking-wider">
            {type.toUpperCase()}
          </span>
        </span>
      );

    case 'generic':
    default:
      return (
        <span
          className="inline-flex items-center gap-1.5 flex-shrink-0 text-[#eaff00]"
          data-file-type="generic"
          data-testid="file-type-icon"
          id="file-type-icon"
          title="Attached File"
        >
          <svg
            aria-label="Generic file icon"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" x2="12" y1="12" y2="18" />
            <line x1="9" x2="15" y1="15" y2="15" />
          </svg>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tech font-extrabold uppercase bg-[#eaff00]/20 text-[#eaff00] border border-[#eaff00]/40 tracking-wider">
            FILE
          </span>
        </span>
      );
  }
}

export async function extractFilePreview(file: File): Promise<FilePreviewData> {
  const fileName = file.name;
  const fileType = getFileType(fileName);
  const sizeKb = file.size > 0 ? `${(file.size / 1024).toFixed(1)} KB` : undefined;

  // 1. XLSX / XLS parsing
  if (fileType === 'xlsx') {
    try {
      const buffer = await file.arrayBuffer();
      const u8 = new Uint8Array(buffer);
      if (isXlsxBytes(u8)) {
        const tabs = parseXlsxTabs(u8);
        const mainTab = tabs.find((t) => t.rows.length > 0) || tabs[0];
        if (mainTab && (mainTab.headers.length > 0 || mainTab.rows.length > 0)) {
          const headers = mainTab.headers.length > 0 ? mainTab.headers : (mainTab.rows[0] ?? []);
          const dataRows = mainTab.headers.length > 0 ? mainTab.rows : mainTab.rows.slice(1);
          const totalRows = dataRows.length;
          const previewRows = dataRows.slice(0, 10);
          return {
            fileName,
            fileType: 'xlsx',
            fileSizeFormatted: sizeKb,
            sheetName: mainTab.name,
            totalRows,
            totalColumns: headers.length,
            headers,
            rows: previewRows,
            truncatedCount: Math.max(0, totalRows - previewRows.length),
          };
        }
      }
    } catch {
      // Fall through to text fallback
    }
  }

  // 2. CSV / TSV / TXT parsing
  if (fileType === 'csv' || fileType === 'tsv' || fileType === 'txt' || fileType === 'generic') {
    try {
      const text = typeof file.text === 'function' ? await file.text() : '';
      const lines = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter((l) => l.trim().length > 0);

      if (lines.length > 0) {
        const delimiter = fileType === 'tsv' ? '\t' : ',';
        const headers = parseCsvLine(lines[0]!, delimiter);
        const dataRows = lines
          .slice(1)
          .map((line) => parseCsvLine(line, delimiter))
          .filter((row) => row.some((cell) => cell.trim().length > 0));
        const totalRows = dataRows.length;
        const previewRows = dataRows.slice(0, 10);
        return {
          fileName,
          fileType: 'csv',
          fileSizeFormatted: sizeKb,
          totalRows,
          totalColumns: headers.length,
          headers,
          rows: previewRows,
          truncatedCount: Math.max(0, totalRows - previewRows.length),
        };
      }
    } catch {
      // Fall through to fallback
    }
  }

  // 3. JSON parsing
  if (fileType === 'json') {
    try {
      const text = typeof file.text === 'function' ? await file.text() : '';
      const parsed = JSON.parse(text);
      const records = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.transactions)
          ? parsed.transactions
          : Array.isArray(parsed?.data)
            ? parsed.data
            : [];
      if (records.length > 0) {
        const headers = Object.keys(records[0] || {});
        const dataRows = records.map((item: Record<string, unknown>) =>
          headers.map((h) => String(item[h] ?? ''))
        );
        const totalRows = dataRows.length;
        const previewRows = dataRows.slice(0, 10);
        return {
          fileName,
          fileType: 'json',
          fileSizeFormatted: sizeKb,
          totalRows,
          totalColumns: headers.length,
          headers,
          rows: previewRows,
          truncatedCount: Math.max(0, totalRows - previewRows.length),
        };
      }
    } catch {
      // Fall through
    }
  }

  // Default fallback for binary/unparseable files
  return {
    fileName,
    fileType,
    fileSizeFormatted: sizeKb,
    totalRows: 1,
    totalColumns: 3,
    headers: ['Index', 'Property', 'File Info'],
    rows: [
      ['01', 'File Name', fileName],
      ['02', 'Detected Type', fileType.toUpperCase()],
      ['03', 'File Size', sizeKb ?? 'Unknown'],
    ],
    truncatedCount: 0,
  };
}

export function getSampleFilePreview(sampleName: string): FilePreviewData {
  if (sampleName.includes('Q3_Consolidated_P&L')) {
    return {
      fileName: 'Q3_Consolidated_P&L.xlsx',
      fileType: 'xlsx',
      sheetName: 'Consolidated P&L Statement',
      totalRows: 248,
      totalColumns: 6,
      headers: ['Date', 'Account / Entity', 'Category', 'Description', 'Amount (INR ₹)', 'Type'],
      rows: [
        ['15/07/2025', 'Tata Consultancy Services', 'Enterprise ARR', 'Annual Enterprise Platform Subscription', '₹12,50,000.00', 'Revenue'],
        ['18/07/2025', 'AWS Asia-Pacific (Mumbai)', 'Cloud Hosting', 'Production Cloud Infrastructure & GPU Nodes', '-₹45,230.00', 'Expense'],
        ['22/07/2025', 'Embassy TechVillage Bengaluru', 'Facilities', 'Office Lease & Core Facility Management', '-₹85,000.00', 'Expense'],
        ['28/07/2025', 'Infosys BPM', 'Client ARR', 'Quarterly Integration & Professional Services', '₹8,40,000.00', 'Revenue'],
        ['02/08/2025', 'Reliance Digital Retail', 'CapEx Equipment', 'Workstation & Hardware Infrastructure Upgrades', '-₹1,20,000.00', 'Expense'],
        ['10/08/2025', 'Razorpay Software Pvt Ltd', 'Payment Gateway', 'Merchant Settlement Batch 892', '₹4,75,500.00', 'Revenue'],
        ['15/08/2025', 'HDFC Bank Corporate', 'Banking Fees', 'Cross-Border Wire Transfer Processing Fee', '-₹1,850.00', 'Expense'],
        ['20/08/2025', 'Freshworks CRM', 'SaaS Stack', 'Annual CRM Tier License & Support', '-₹62,000.00', 'Expense'],
        ['25/08/2025', 'Wipro Technologies', 'Enterprise ARR', 'Custom Workflow Module Expansion', '₹6,15,000.00', 'Revenue'],
        ['30/08/2025', 'Zomato Corporate Perks', 'Team Perks', 'Quarterly Team Lunch Allotment', '-₹18,500.00', 'Expense'],
      ],
      truncatedCount: 238,
    };
  }

  return {
    fileName: 'SeriesB_Ledger.csv',
    fileType: 'csv',
    totalRows: 420,
    totalColumns: 6,
    headers: ['Txn ID', 'Date', 'Counterparty', 'Department', 'Amount (INR ₹)', 'Direction'],
    rows: [
      ['TX-2025-0101', '04/01/2025', 'Peak XV Partners', 'Treasury & Reserves', '₹50,00,00,000.00', 'Inflow'],
      ['TX-2025-0102', '12/01/2025', 'Google Cloud India', 'Engineering & Ops', '-₹3,40,000.00', 'Outflow'],
      ['TX-2025-0103', '15/01/2025', 'WeWork Galaxy Bangalore', 'Facilities', '-₹1,75,000.00', 'Outflow'],
      ['TX-2025-0104', '20/01/2025', 'Dunzo Business Logistics', 'Operations', '-₹28,400.00', 'Outflow'],
      ['TX-2025-0105', '28/01/2025', 'Swiggy Instamart B2B', 'Office Supplies', '-₹14,250.00', 'Outflow'],
      ['TX-2025-0106', '02/02/2025', 'Enterprise Client Apex', 'ARR Contract', '₹35,00,000.00', 'Inflow'],
      ['TX-2025-0107', '10/02/2025', 'Zoho Workplace Stack', 'Cloud & SaaS', '-₹48,000.00', 'Outflow'],
      ['TX-2025-0108', '18/02/2025', 'Airtel Enterprise Leased Line', 'Telecom', '-₹12,800.00', 'Outflow'],
      ['TX-2025-0109', '25/02/2025', 'Cisco Systems India', 'Network Hardware', '-₹2,90,000.00', 'Outflow'],
      ['TX-2025-0110', '28/02/2025', 'Keka Payroll Software', 'HR & Benefits', '-₹32,000.00', 'Outflow'],
    ],
    truncatedCount: 410,
  };
}

export default function App(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [activeFileType, setActiveFileType] = useState<FileType>('xlsx');
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasBorderHighlight, setHasBorderHighlight] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');
  const [isLinked, setIsLinked] = useState(false);
  const [isDeepAudit, setIsDeepAudit] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ctaLabel, setCtaLabel] = useState('OPEN FINANCE STORY');
  const [ctaArrow, setCtaArrow] = useState('→');
  const [isArrowSpinning, setIsArrowSpinning] = useState(false);
  const [isCtaHighlighted, setIsCtaHighlighted] = useState(false);
  const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [selectedSampleName, setSelectedSampleName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const driveInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  // Synchronize ref with state to prevent race conditions during rapid clicks
  isProcessingRef.current = isProcessing;

  // Escape key handler to close preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Parallax effect on ambient floating background tiles
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      const mouseX = e.clientX / window.innerWidth - 0.5;
      const mouseY = e.clientY / window.innerHeight - 0.5;
      const tiles = document.querySelectorAll<HTMLElement>('#ambient-canvas > div');
      tiles.forEach((tile, index) => {
        const depth = (index + 1) * 6;
        tile.style.transform = `translate(${mouseX * depth}px, ${mouseY * depth}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Tab switching logic
  const handleTabClick = (tab: TabType): void => {
    setActiveTab(tab);
    if (tab === 'drive') {
      setTimeout(() => {
        driveInputRef.current?.focus();
      }, 0);
    } else if (tab === 'upload') {
      dropZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Drop zone click and keyboard triggers
  const handleDropZoneClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleDropZoneKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  // Drag-and-drop event handlers
  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      setAttachedFiles(Array.from(files));
      setSelectedSampleName(null);
      const detected = getFileType(firstFile.name);
      setActiveFileType(detected);
      setHasBorderHighlight(true);
      setStatusMessage(`Parsing: ${firstFile.name}...`);
      try {
        const preview = await extractFilePreview(firstFile);
        setPreviewData(preview);
        setIsPreviewOpen(true);
        setStatusMessage(
          `${files.length} file(s) attached: ${firstFile.name} (${preview.totalRows.toLocaleString('en-IN')} rows detected)`
        );
      } catch {
        setStatusMessage(`${files.length} file(s) attached: ${firstFile.name}`);
      }
    }
  };

  // File input change handler
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      setAttachedFiles(Array.from(files));
      setSelectedSampleName(null);
      const detected = getFileType(firstFile.name);
      setActiveFileType(detected);
      setHasBorderHighlight(true);
      setStatusMessage(`Parsing: ${firstFile.name}...`);
      try {
        const preview = await extractFilePreview(firstFile);
        setPreviewData(preview);
        setIsPreviewOpen(true);
        setStatusMessage(
          `Attached: ${firstFile.name} (${preview.totalRows.toLocaleString('en-IN')} rows detected)`
        );
      } catch {
        setStatusMessage(`Attached: ${firstFile.name}`);
      }
    }
  };

  // Sample data chips click handler
  const handleSampleChipClick = (fileName: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setSelectedSampleName(fileName);
    setAttachedFiles([]);
    const detected = getFileType(fileName);
    setActiveFileType(detected);
    const preview = getSampleFilePreview(fileName);
    setPreviewData(preview);
    setIsPreviewOpen(true);
    setStatusMessage(
      `Attached: ${fileName} (${preview.totalRows.toLocaleString('en-IN')} rows ready)`
    );
    setHasBorderHighlight(true);
  };

  // Google Drive link import button handler
  const handleImportClick = (): void => {
    if (driveUrl.trim() !== '') {
      setIsLinked(true);
      setTimeout(() => {
        setIsLinked(false);
      }, 2400);
    } else {
      driveInputRef.current?.focus();
    }
  };

  // Main CTA button click state & execution
  const handleOpenStoryCta = async (): Promise<void> => {
    if (isProcessingRef.current) return;
    setIsProcessing(true);
    isProcessingRef.current = true;

    setCtaLabel(isDeepAudit ? 'SPINNING UP PYTHON SANDBOX...' : 'PARSING FINANCIAL STORY...');
    setCtaArrow('◐');
    setIsArrowSpinning(true);

    try {
      let rawFiles: RawIngestFile[] = [];
      if (attachedFiles.length > 0) {
        rawFiles = await readBrowserFiles(attachedFiles);
      } else {
        const sampleFileName = selectedSampleName || 'SeriesB_Ledger.csv';
        const samplePreview = getSampleFilePreview(sampleFileName);
        const headerCsv = samplePreview.headers.join(',');
        const rowsCsv = samplePreview.rows
          .map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(','))
          .join('\n');
        rawFiles = [
          {
            name: sampleFileName,
            mimeType: 'text/csv',
            content: `${headerCsv}\n${rowsCsv}`,
            encoding: 'utf8',
          },
        ];
      }

      const bundle = await processByoIngestion({
        files: rawFiles,
        deepAgentAudit: isDeepAudit,
        onProgress: (step) => {
          setStatusMessage(step.label);
        },
      });

      setCtaLabel('FINANCIAL STORY READY ✓');
      setIsArrowSpinning(false);
      setCtaArrow('→');
      setIsCtaHighlighted(true);
      setStatusMessage(
        `Financial story successfully generated (${bundle.transactions.length.toLocaleString('en-IN')} records, ${bundle.plan.business_meta?.archetype_label || 'Executive Story'}).`
      );

      if (typeof window !== 'undefined' && window.__YEAR_APP__?.player) {
        window.__YEAR_APP__.player.loadDataset(bundle, true);
      }

      setTimeout(() => {
        setCtaLabel('OPEN FINANCE STORY');
        setIsCtaHighlighted(false);
        setIsProcessing(false);
        isProcessingRef.current = false;
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse financial dataset';
      setStatusMessage(`Error: ${msg}`);
      setCtaLabel('OPEN FINANCE STORY');
      setIsArrowSpinning(false);
      setCtaArrow('→');
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#08090a] text-neutral-100 flex flex-col justify-between selection:bg-[#eaff00] selection:text-black relative antialiased">
      {/* BEGIN: AmbientAnimatedBackground */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        data-purpose="ambient-canvas-tiles"
        id="ambient-canvas"
      >
        {/* Top-left amber & slate tiles */}
        <div className="absolute top-[8%] left-[5%] w-14 h-14 bg-[#543026]/40 border border-amber-600/25 backdrop-blur-[2px] tile-float-1"></div>
        <div className="absolute top-[20%] left-[12%] w-20 h-20 bg-[#3b442b]/35 border border-lime-600/25 tile-float-2"></div>
        <div className="absolute top-[32%] left-[3%] w-12 h-12 bg-slate-800/40 border border-slate-600/30 tile-float-4"></div>
        {/* Center floating tiles */}
        <div className="absolute top-[12%] left-[36%] w-16 h-16 bg-[#233544]/45 border border-cyan-700/30 tile-float-3"></div>
        <div className="absolute top-[22%] left-[48%] w-12 h-12 bg-amber-900/30 border border-amber-500/20 tile-float-5"></div>
        <div className="absolute top-[8%] left-[62%] w-18 h-18 bg-[#3f4325]/40 border border-yellow-700/25 tile-float-1"></div>
        <div className="absolute top-[28%] right-[8%] w-16 h-16 bg-[#463022]/45 border border-amber-700/30 tile-float-4"></div>
        {/* Bottom ambient tiles */}
        <div className="absolute bottom-[20%] left-[8%] w-16 h-16 bg-[#57271e]/40 border border-red-900/30 tile-float-2"></div>
        <div className="absolute bottom-[10%] left-[22%] w-14 h-14 bg-slate-800/45 border border-slate-600/25 tile-float-5"></div>
        <div className="absolute bottom-[24%] left-[42%] w-12 h-12 bg-[#2d3a33]/40 border border-emerald-800/25 tile-float-3"></div>
        <div className="absolute bottom-[12%] right-[25%] w-20 h-20 bg-[#2d283e]/40 border border-purple-900/30 tile-float-1"></div>
        <div className="absolute bottom-[22%] right-[10%] w-16 h-16 bg-[#3a4427]/40 border border-lime-800/30 tile-float-4"></div>
      </div>
      {/* END: AmbientAnimatedBackground */}

      {/* BEGIN: MainHeader */}
      <header
        className="relative z-10 w-full px-6 sm:px-10 lg:px-16 pt-7 pb-4 flex items-center justify-between font-mono-tech text-xs tracking-wider"
        data-purpose="top-navigation"
      >
        <div className="flex items-center space-x-3 text-neutral-300">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#eaff00] shadow-[0_0_8px_rgba(234,255,0,0.8)] animate-pulse"></span>
          <span className="font-semibold uppercase tracking-widest text-[11px] sm:text-xs text-white">
            FINANCE STORY
          </span>
          <span className="text-neutral-500 font-bold">•</span>
          <span className="text-[#eaff00] uppercase tracking-widest text-[11px] sm:text-xs font-bold">
            INR ₹ STANDARDS
          </span>
          <span className="text-neutral-500 font-bold">•</span>
          <span className="text-neutral-400 uppercase tracking-widest text-[11px] sm:text-xs">
            INTERACTIVE SUMMARY
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <button
            className="group flex items-center space-x-2 text-neutral-400 hover:text-white transition-colors duration-200 tracking-widest uppercase text-[11px] sm:text-xs font-semibold focus:outline-none"
            type="button"
          >
            <span className="w-1.5 h-1.5 rounded-sm bg-neutral-600 group-hover:bg-[#ff4614] group-hover:shadow-[0_0_6px_rgba(255,70,20,0.8)] transition-all"></span>
            <span>LEDGER ANALYSIS</span>
          </button>
        </div>
      </header>
      {/* END: MainHeader */}

      {/* BEGIN: Main Interactive Layout Container */}
      <main
        className="relative z-10 flex-grow flex items-center justify-center px-4 sm:px-8 lg:px-14 py-8 md:py-12"
        data-purpose="modular-workspace"
      >
        {/* Modular Decoupled Cards Flex Container */}
        <div className="w-full max-w-7xl flex flex-col lg:flex-row items-stretch lg:items-start justify-center gap-6 lg:gap-8">
          {/* ========================================== */}
          {/* 1. SIGNATURE FIXED-SIZE YELLOW HERO CARD  */}
          {/* ========================================== */}
          <section
            aria-labelledby="executive-intelligence-title"
            className="yellow-hero-card bg-[#eaff00] text-black p-8 sm:p-10 md:p-12 flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.65)] border border-[#d4ff00]/60 transition-all duration-300 hover:shadow-[0_25px_60px_rgba(234,255,0,0.18)] hover:-translate-y-1 relative select-none rounded-none"
            data-purpose="executive-intelligence-hero"
          >
            {/* Top header info */}
            <div>
              <div className="font-mono-tech text-xs font-bold uppercase tracking-[0.22em] text-black border-b border-black/20 pb-4 flex items-center justify-between">
                <span>EXECUTIVE INTELLIGENCE</span>
                <span className="text-[10px] bg-black text-[#eaff00] font-mono px-2 py-0.5 font-bold tracking-wider">
                  CORE
                </span>
              </div>
              {/* Headline */}
              <div className="pt-8 sm:pt-10">
                <h1
                  className="font-heading font-extrabold text-5xl sm:text-6xl md:text-[76px] leading-[0.92] tracking-tighter text-black"
                  id="executive-intelligence-title"
                >
                  Finance
                  <br />
                  Story.
                </h1>
              </div>
            </div>
            {/* Bottom Description & Tag */}
            <div className="mt-14 sm:mt-20 pt-6 border-t border-black/20">
              <p className="font-sans text-base sm:text-lg md:text-xl font-medium leading-snug text-neutral-900">
                Turn financial ledgers, Excel workbooks, or Google Drive folders into an interactive
                Indian financial summary (INR ₹).
              </p>
              <div className="mt-6 flex items-center space-x-2 font-mono-tech text-[11px] text-neutral-900 font-bold tracking-wider">
                <span className="inline-block w-2 h-2 bg-black rounded-full animate-ping"></span>
                <span>● REAL-TIME MULTI-ENTITY ENGINE v2.4 · INDIAN STANDARDS (₹)</span>
              </div>
            </div>
          </section>

          {/* ========================================== */}
          {/* 2. FLEXIBLE DYNAMIC ORANGE DATA INGEST CARD */}
          {/* ========================================== */}
          <section
            aria-labelledby="data-source-title"
            className="orange-ingestion-card bg-[#ff4614] text-white p-7 sm:p-9 md:p-10 flex flex-col justify-between shadow-[0_20px_50px_rgba(255,70,20,0.18)] border border-white/10 transition-all duration-300 relative rounded-none"
            data-purpose="connect-data-source-panel"
          >
            {/* Top Module Section */}
            <div className="space-y-5">
              {/* Card Header & Badge */}
              <div className="flex items-center justify-between border-b border-black/25 pb-4">
                <h2
                  className="font-mono-tech text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-white flex items-center space-x-2"
                  id="data-source-title"
                >
                  <span className="inline-block w-2 h-2 bg-white"></span>
                  <span>CONNECT DATA SOURCE</span>
                </h2>
                <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-mono-tech font-semibold bg-black/35 text-white tracking-widest border border-white/10">
                  SECURE TLS-256
                </span>
              </div>

              {/* Source Interactive Switcher Tabs */}
              <div className="flex items-center space-x-1 border-b border-black/20 pb-1" role="tablist">
                <button
                  aria-selected={activeTab === 'upload'}
                  className={`px-3.5 py-1.5 text-xs font-mono-tech uppercase transition-all focus:outline-none ${
                    activeTab === 'upload'
                      ? 'font-bold text-white bg-black/40 border border-white/20'
                      : 'font-semibold text-white/70 hover:text-white hover:bg-black/20'
                  }`}
                  id="tab-upload"
                  onClick={() => handleTabClick('upload')}
                  role="tab"
                  type="button"
                >
                  UPLOAD FILE
                </button>
                <button
                  aria-selected={activeTab === 'drive'}
                  className={`px-3.5 py-1.5 text-xs font-mono-tech uppercase transition-all focus:outline-none ${
                    activeTab === 'drive'
                      ? 'font-bold text-white bg-black/40 border border-white/20'
                      : 'font-semibold text-white/70 hover:text-white hover:bg-black/20'
                  }`}
                  id="tab-drive"
                  onClick={() => handleTabClick('drive')}
                  role="tab"
                  type="button"
                >
                  GOOGLE DRIVE / SHEETS
                </button>
                <button
                  aria-selected={activeTab === 'sample'}
                  className={`px-3.5 py-1.5 text-xs font-mono-tech uppercase transition-all focus:outline-none ${
                    activeTab === 'sample'
                      ? 'font-bold text-white bg-black/40 border border-white/20'
                      : 'font-semibold text-white/70 hover:text-white hover:bg-black/20'
                  }`}
                  id="tab-sample"
                  onClick={() => handleTabClick('sample')}
                  role="tab"
                  type="button"
                >
                  SAMPLE DATA
                </button>
              </div>

              {/* Enhanced Interactive Drop Zone */}
              <div
                aria-label="Upload Excel, CSV, JSON or PDF files"
                className={`group cursor-pointer bg-[#0f1013] hover:bg-black border rounded-none p-6 sm:p-7 text-center transition-all duration-200 hover:shadow-2xl relative ${
                  isDragOver ? 'dragover-highlight' : ''
                } ${hasBorderHighlight ? 'border-[#eaff00]' : 'border-black/80'}`}
                data-purpose="file-upload-dropzone"
                id="drop-zone"
                onClick={handleDropZoneClick}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onKeyDown={handleDropZoneKeyDown}
                ref={dropZoneRef}
                role="button"
                tabIndex={0}
              >
                <input
                  accept=".xlsx,.xls,.csv,.json,.pdf"
                  className="hidden"
                  id="file-input"
                  multiple
                  onChange={handleFileInputChange}
                  ref={fileInputRef}
                  type="file"
                />
                <div className="flex flex-col items-center justify-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#eaff00]/10 transition-all">
                    <svg
                      className="w-5 h-5 text-[#eaff00]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <span className="font-mono-tech text-xs sm:text-[13px] font-bold tracking-wider text-[#eaff00] group-hover:brightness-125 transition-colors">
                    UPLOAD EXCEL (.XLSX), CSV, JSON, OR PDF (INR ₹ / LAKHS &amp; CRORES)
                  </span>
                  <p className="font-sans text-xs sm:text-sm text-neutral-400 group-hover:text-neutral-200">
                    Drag &amp; drop files here (Indian formats DD/MM/YYYY supported) or{' '}
                    <span className="underline decoration-neutral-500 underline-offset-4 font-semibold text-white group-hover:text-[#eaff00] transition-colors">
                      click to browse
                    </span>
                  </p>
                </div>

                {/* File Attached Notification */}
                <div
                  className={`${
                    statusMessage ? 'flex' : 'hidden'
                  } mt-3 p-2.5 bg-[#eaff00]/10 border border-[#eaff00]/40 text-xs font-mono text-[#eaff00] items-center justify-between gap-3`}
                  id="drop-status"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileTypeIcon type={activeFileType} />
                    <span className="truncate" id="drop-status-text">
                      {statusMessage || '1 file selected: sample_financial_ledger_2025.xlsx [INR ₹]'}
                    </span>
                  </div>
                  {previewData && (
                    <button
                      className="px-2.5 py-1 text-[10px] font-mono-tech font-extrabold uppercase bg-[#eaff00] text-black hover:bg-white transition-colors flex-shrink-0 tracking-wider shadow-sm cursor-pointer"
                      data-testid="btn-preview-data"
                      id="btn-preview-data"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPreviewOpen(true);
                      }}
                      title="Inspect truncated table view of data"
                      type="button"
                    >
                      Preview Table ⤢
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Test Sample Data Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="text-[10px] font-mono-tech uppercase text-neutral-200/80 tracking-wider">
                  Quick Samples:
                </span>
                <button
                  className="sample-chip text-[11px] font-mono bg-black/40 hover:bg-black hover:text-[#eaff00] text-neutral-200 px-2.5 py-1 border border-black/30 transition-all flex items-center space-x-1"
                  data-sample="Q3_Consolidated_P&L.xlsx"
                  onClick={(e) => handleSampleChipClick('Q3_Consolidated_P&L.xlsx', e)}
                  type="button"
                >
                  <span>📊</span>
                  <span>Q3_Consolidated_P&amp;L.xlsx</span>
                </button>
                <button
                  className="sample-chip text-[11px] font-mono bg-black/40 hover:bg-black hover:text-[#eaff00] text-neutral-200 px-2.5 py-1 border border-black/30 transition-all flex items-center space-x-1"
                  data-sample="SeriesB_Ledger.csv"
                  onClick={(e) => handleSampleChipClick('SeriesB_Ledger.csv', e)}
                  type="button"
                >
                  <span>📑</span>
                  <span>SeriesB_Ledger.csv</span>
                </button>
              </div>

              {/* Google Drive / Sheets Link Integration Bar */}
              <div className="pt-1">
                <form
                  className="flex flex-col sm:flex-row shadow-lg"
                  id="drive-link-form"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <input
                    aria-label="Google Drive or Sheets link input"
                    className="flex-1 bg-white text-neutral-900 placeholder:text-neutral-500 px-4 py-3 text-xs sm:text-sm border-0 focus:ring-2 focus:ring-black outline-none font-sans rounded-none transition-shadow"
                    id="drive-link"
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="Public Google Drive folder or Sheets link..."
                    ref={driveInputRef}
                    type="url"
                    value={driveUrl}
                  />
                  <button
                    className={`bg-[#0f1013] hover:bg-black active:bg-neutral-900 font-mono-tech font-bold text-xs uppercase px-8 py-3 tracking-widest transition-all duration-150 border-t sm:border-t-0 sm:border-l border-black/50 focus:outline-none ${
                      isLinked ? 'text-[#eaff00]' : 'text-white hover:text-[#eaff00]'
                    }`}
                    id="btn-import"
                    onClick={handleImportClick}
                    type="button"
                  >
                    {isLinked ? 'LINKED ✓' : 'IMPORT'}
                  </button>
                </form>
              </div>

              {/* Microcopy & Legal Disclaimers (Verbatim) */}
              <div
                className="text-[10px] leading-relaxed text-neutral-100/90 font-sans space-y-1.5 pt-1"
                data-purpose="compliance-disclaimer"
              >
                <p>
                  By using this feature, you confirm that you have the necessary rights to any content
                  that you upload. Do not generate content that infringes on others' intellectual
                  property or privacy rights. Your use of this generative AI service is subject to our{' '}
                  <a
                    className="underline hover:text-white transition-colors decoration-white/60 font-medium"
                    href="#"
                  >
                    Prohibited Use Policy
                  </a>
                  .
                </p>
                <p className="text-neutral-100/75">
                  Please note that uploads from Google Workspace may be used to develop and improve Google
                  products and services in accordance with our{' '}
                  <a
                    className="underline hover:text-white transition-colors decoration-white/60 font-medium"
                    href="#"
                  >
                    terms
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Bottom Controls & Execution Button */}
            <div className="mt-8 space-y-4 pt-4 border-t border-black/25">
              {/* Advanced Deep Agent Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none group">
                  <input
                    checked={isDeepAudit}
                    className="w-4 h-4 rounded-none bg-black/50 border-black/80 text-black focus:ring-0 focus:ring-offset-0 cursor-pointer transition-colors checked:bg-black"
                    id="deep-audit"
                    onChange={(e) => setIsDeepAudit(e.target.checked)}
                    type="checkbox"
                  />
                  <span className="font-sans text-xs font-semibold text-white tracking-wide group-hover:text-neutral-100">
                    Advanced: Deep Agent Audit
                  </span>
                </label>
                <span className="font-mono-tech text-[10px] font-bold tracking-widest text-neutral-100 bg-black/35 px-2.5 py-1 self-start sm:self-auto uppercase border border-black/20">
                  PYTHON SANDBOX • UP TO 10 MIN
                </span>
              </div>

              {/* Main Primary Action Button */}
              <button
                className={`w-full bg-[#0a0a0c] hover:bg-black active:scale-[0.99] transition-all duration-200 font-mono-tech font-bold text-xs sm:text-sm tracking-[0.18em] uppercase py-4 px-6 flex items-center justify-center space-x-3 shadow-2xl group border border-black/50 focus:outline-none ${
                  isCtaHighlighted
                    ? 'text-[#eaff00] border-[#eaff00]'
                    : 'text-white hover:text-[#eaff00]'
                }`}
                id="open-story-cta"
                onClick={handleOpenStoryCta}
                type="button"
              >
                <span id="cta-label">{ctaLabel}</span>
                <span
                  className={`transform transition-transform duration-200 group-hover:translate-x-1.5 text-base ${
                    isArrowSpinning ? 'animate-spin' : ''
                  }`}
                  id="cta-arrow"
                >
                  {ctaArrow}
                </span>
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* BEGIN: BottomDockBar */}
      <footer
        className="relative z-10 w-full bg-[#0f1013]/95 border-t border-neutral-800/80 px-6 sm:px-10 py-3 flex items-center justify-between text-neutral-400 font-mono-tech text-[11px]"
        data-purpose="dock-status-bar"
      >
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <span className="text-neutral-200 font-semibold">GATEWAY: ACTIVE</span>
          </span>
          <span className="hidden sm:inline-block text-neutral-600">|</span>
          <span className="hidden sm:inline-block text-neutral-400 tracking-wider">
            FINANCIAL GRAPH PARSER V4.2 · INR ₹ (LAKHS &amp; CRORES)
          </span>
        </div>
        {/* Center pill bar handle indicator */}
        <div className="hidden md:flex items-center justify-center">
          <div
            className="w-16 h-1.5 rounded-full bg-neutral-700/80 hover:bg-neutral-500 hover:w-20 transition-all cursor-pointer"
            title="Expand Ledger Terminal"
          ></div>
        </div>
        <div className="flex items-center space-x-3 text-neutral-400">
          <button
            aria-label="Toggle drawer"
            className="hover:text-white transition-colors p-1"
            type="button"
          >
            <svg
              className="w-4 h-4 transform hover:-translate-y-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 15l7-7 7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              ></path>
            </svg>
          </button>
        </div>
      </footer>
      {/* END: BottomDockBar */}

      {/* BEGIN: Truncated Table View Preview Modal */}
      {isPreviewOpen && previewData && (
        <div
          aria-labelledby="preview-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
          data-purpose="file-preview-modal"
          data-testid="file-preview-modal"
          id="file-preview-modal"
          onClick={() => setIsPreviewOpen(false)}
          role="dialog"
        >
          <div
            className="bg-[#0c0d10] border border-neutral-700/80 shadow-[0_25px_70px_rgba(0,0,0,0.95)] max-w-5xl w-full max-h-[90vh] flex flex-col relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Accent Bar */}
            <div className="h-1 w-full bg-[#eaff00]" />

            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono-tech uppercase text-[#eaff00] tracking-widest flex items-center gap-2 mb-1.5">
                  <span>DATASET PREVIEW &amp; VERIFICATION</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-emerald-400">UPLOAD SUCCESSFUL ✓</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileTypeIcon type={previewData.fileType} />
                  <h3
                    className="text-base sm:text-lg font-bold text-white font-mono tracking-wide"
                    id="preview-modal-title"
                  >
                    {previewData.fileName}
                  </h3>
                </div>
                {/* Metadata line without pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-400 mt-2">
                  <span>{previewData.totalRows.toLocaleString('en-IN')} total rows</span>
                  <span className="text-neutral-600">·</span>
                  <span>{previewData.headers.length} columns</span>
                  <span className="text-neutral-600">·</span>
                  <span>Showing first {previewData.rows.length} rows</span>
                  {previewData.sheetName && (
                    <>
                      <span className="text-neutral-600">·</span>
                      <span className="text-neutral-300">Sheet: {previewData.sheetName}</span>
                    </>
                  )}
                  {previewData.fileSizeFormatted && (
                    <>
                      <span className="text-neutral-600">·</span>
                      <span className="text-neutral-400">{previewData.fileSizeFormatted}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                aria-label="Close Preview Modal"
                className="group px-3 py-1.5 text-xs font-mono font-semibold text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 transition-all flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-[#eaff00]"
                data-testid="close-preview-modal-btn"
                id="close-preview-modal-btn"
                onClick={() => setIsPreviewOpen(false)}
                type="button"
              >
                <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300">ESC</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>

            {/* Truncated Table View Container */}
            <div className="overflow-auto flex-1 min-h-[220px] max-h-[50vh] bg-[#090a0c]">
              <table
                className="w-full text-left border-collapse font-mono text-xs"
                data-testid="preview-table"
                id="preview-table"
              >
                <thead
                  className="sticky top-0 bg-[#14161b] z-10 border-b border-neutral-700 shadow-sm"
                  data-testid="preview-table-header"
                >
                  <tr>
                    <th className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 border-r border-neutral-800/80 w-12 text-center">
                      #
                    </th>
                    {previewData.headers.map((header, idx) => (
                      <th
                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#eaff00] border-r border-neutral-800/60 whitespace-nowrap"
                        key={`th-${idx}`}
                      >
                        {header || `Column ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900" data-testid="preview-table-body">
                  {previewData.rows.map((row, rowIdx) => (
                    <tr
                      className="hover:bg-neutral-800/40 transition-colors group"
                      data-testid="preview-table-row"
                      key={`tr-${rowIdx}`}
                    >
                      <td className="px-3.5 py-2.5 text-[11px] text-neutral-500 font-mono text-center border-r border-neutral-800/60 bg-neutral-950/40">
                        {String(rowIdx + 1).padStart(2, '0')}
                      </td>
                      {previewData.headers.map((_, colIdx) => {
                        const val = row[colIdx] ?? '';
                        const isCurrency =
                          val.includes('₹') || val.includes('INR') || val.includes('$');
                        const isNegative = val.includes('-') || /^\(.*\)$/.test(val);
                        return (
                          <td
                            className={`px-4 py-2.5 text-[12px] whitespace-nowrap border-r border-neutral-900/60 ${
                              isCurrency
                                ? isNegative
                                  ? 'text-rose-400 font-semibold'
                                  : 'text-emerald-300 font-semibold'
                                : 'text-neutral-300'
                            }`}
                            key={`cell-${rowIdx}-${colIdx}`}
                          >
                            {val.trim() || <span className="text-neutral-600">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Truncated Notice Banner */}
            <div
              className="px-5 py-2.5 bg-[#14161b] border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono text-neutral-400"
              data-testid="preview-truncated-notice"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#eaff00] font-bold">ℹ</span>
                <span>
                  Displaying truncated sample of{' '}
                  <strong className="text-white font-semibold">{previewData.rows.length}</strong> of{' '}
                  <strong className="text-white font-semibold">
                    {previewData.totalRows.toLocaleString('en-IN')}
                  </strong>{' '}
                  total rows.
                  {previewData.truncatedCount > 0 && (
                    <span className="text-neutral-500 ml-1">
                      ({previewData.truncatedCount.toLocaleString('en-IN')} remaining rows withheld
                      from preview)
                    </span>
                  )}
                </span>
              </div>
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider hidden sm:inline-block">
                All records ready for parsing
              </span>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 sm:p-5 bg-[#0e0f13] border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] font-mono text-neutral-400">
                Ready to generate interactive Indian standards finance story
              </div>
              <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                <button
                  className="px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 transition-colors focus:outline-none"
                  onClick={() => setIsPreviewOpen(false)}
                  type="button"
                >
                  Close Preview
                </button>
                <button
                  className="px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider text-black bg-[#eaff00] hover:bg-[#d4ff00] transition-colors focus:outline-none flex items-center gap-2 shadow-[0_0_15px_rgba(234,255,0,0.3)] hover:shadow-[0_0_20px_rgba(234,255,0,0.5)]"
                  data-testid="btn-proceed-from-preview"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    handleOpenStoryCta();
                  }}
                  type="button"
                >
                  <span>Proceed to Story</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* END: Truncated Table View Preview Modal */}
    </div>
  );
}
